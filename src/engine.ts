import { CODE_INDENT_WIDTH, SPOILER_DELIMITER, UNSAFE_URL_PROTOCOLS } from './constants.js';
import type {
  BlockNode,
  BlockQuoteNode,
  CodeBlockNode,
  EmphasisNode,
  InlineContainerNode,
  InlineNode,
  LinkNode,
  ListItemNode,
  ListNode,
  ParagraphNode,
  PostReferenceNode,
  ResolvedWakabamarkEngineOptions,
  SpoilerNode,
  StrongNode,
  WakabamarkAst,
  WakabamarkEngineOptions,
} from './types.js';
import {
  assertValidInlinePluginMatch,
  escapeHtml,
  escapeHtmlAttribute,
  escapeMarkdownLinkDestination,
  escapeMarkdownLinkText,
  escapeMarkdownText,
  isBlankLine,
  isBlockOpeningLine,
  isBlockQuoteLine,
  isIndentedCodeLine,
  isMarkdownAutolinkSafe,
  isOrderedListStartLine,
  isSafePluginHref,
  isUnorderedListLine,
  mergeAdjacentTextNodes,
  normalizeInput,
  pushPendingText,
  renderMarkdownCodeSpan,
  resolveWakabamarkEngineOptions,
  trimTrailingUrlPunctuation,
} from './utils.js';

const BBCODE_TO_NODE_TYPE = {
  b: 'strong',
  i: 'emphasis',
  u: 'underline',
  s: 'strikethrough',
  spoiler: 'spoiler',
  sup: 'superscript',
  sub: 'subscript',
} as const;

type SupportedBbCodeTagName = keyof typeof BBCODE_TO_NODE_TYPE;

export class WakabamarkEngine {
  private readonly options: Readonly<ResolvedWakabamarkEngineOptions>;

  public constructor(options: WakabamarkEngineOptions = {}) {
    this.options = resolveWakabamarkEngineOptions(options);
  }

  public parse(input: string): WakabamarkAst {
    return {
      type: 'document',
      children: parseBlocks(normalizeInput(input), this.options),
    };
  }

  public renderHtml(input: string | WakabamarkAst): string {
    const ast = typeof input === 'string' ? this.parse(input) : input;

    return ast.children.map(block => renderBlockHtml(block, this.options)).join('');
  }

  public renderMarkdown(input: string | WakabamarkAst): string {
    const ast = typeof input === 'string' ? this.parse(input) : input;

    return ast.children.map(renderBlockMarkdown).join('\n\n');
  }

  public extractPlainText(input: string | WakabamarkAst): string {
    const ast = typeof input === 'string' ? this.parse(input) : input;

    return ast.children.map(extractBlockPlainText).join('\n\n');
  }
}

function parseBlocks(input: string, options: Readonly<ResolvedWakabamarkEngineOptions>): BlockNode[] {
  const lines = input.split('\n');
  const blocks: BlockNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (isBlankLine(line)) {
      index += 1;
      continue;
    }

    const codeBlock = tryParseCodeBlock(lines, index);
    if (codeBlock) {
      blocks.push(codeBlock.node);
      index = codeBlock.nextIndex;
      continue;
    }

    const list = tryParseList(lines, index, options);
    if (list) {
      blocks.push(list.node);
      index = list.nextIndex;
      continue;
    }

    const blockQuote = tryParseBlockQuote(lines, index, options);
    if (blockQuote) {
      blocks.push(blockQuote.node);
      index = blockQuote.nextIndex;
      continue;
    }

    const paragraph = tryParseParagraph(lines, index, options);
    blocks.push(paragraph.node);
    index = paragraph.nextIndex;
  }

  return blocks;
}

function renderBlockHtml(block: BlockNode, options: Readonly<ResolvedWakabamarkEngineOptions>): string {
  switch (block.type) {
    case 'paragraph':
      return `<p>${block.children.map(node => renderInlineHtml(node, options)).join('')}</p>`;
    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul';
      const items = block.items.map(item => `<li>${renderInlineLinesHtml(item.lines, options)}</li>`).join('');

      return `<${tag}>${items}</${tag}>`;
    }
    case 'blockquote':
      return `<blockquote class="${escapeHtmlAttribute(options.html.blockquoteClassName)}"><p>${renderBlockQuoteLinesHtml(block.lines, options)}</p></blockquote>`;
    case 'code-block':
      return `<pre><code>${escapeHtml(block.value)}</code></pre>`;
  }
}

function renderInlineHtml(node: InlineNode, options: Readonly<ResolvedWakabamarkEngineOptions>): string {
  switch (node.type) {
    case 'text':
      return renderHtmlTextValue(node.value);
    case 'emphasis':
      return renderContainerHtml('em', node.children, options);
    case 'strong':
      return renderContainerHtml('strong', node.children, options);
    case 'underline':
      return renderContainerHtml('u', node.children, options);
    case 'strikethrough':
      return renderContainerHtml('s', node.children, options);
    case 'spoiler':
      return `<span class="${escapeHtmlAttribute(options.html.spoilerClassName)}">${node.children
        .map(child => renderInlineHtml(child, options))
        .join('')}</span>`;
    case 'superscript':
      return renderContainerHtml('sup', node.children, options);
    case 'subscript':
      return renderContainerHtml('sub', node.children, options);
    case 'code-span':
      return `<code>${escapeHtml(node.value)}</code>`;
    case 'link': {
      const href = escapeHtmlAttribute(node.href);
      const text = escapeHtml(node.text);

      if (node.external) {
        const targetAttribute = options.html.externalLinkTarget
          ? ` target="${escapeHtmlAttribute(options.html.externalLinkTarget)}"`
          : '';

        return `<a href="${href}" rel="${escapeHtmlAttribute(options.html.externalLinkRel)}"${targetAttribute}>${text}</a>`;
      }

      return `<a href="${href}">${text}</a>`;
    }
    case 'post-reference':
      return `<a href="${escapeHtmlAttribute(node.href)}" data-post-ref="${escapeHtmlAttribute(node.postId)}">&gt;&gt;${escapeHtml(node.postId)}</a>`;
  }
}

function renderContainerHtml(
  tagName: 'em' | 'strong' | 'u' | 's' | 'sup' | 'sub',
  children: InlineNode[],
  options: Readonly<ResolvedWakabamarkEngineOptions>,
): string {
  return `<${tagName}>${children.map(child => renderInlineHtml(child, options)).join('')}</${tagName}>`;
}

function renderInlineLinesHtml(lines: InlineNode[][], options: Readonly<ResolvedWakabamarkEngineOptions>): string {
  return lines.map(line => renderInlineLineHtml(line, options)).join('<br />');
}

function renderBlockQuoteLinesHtml(lines: InlineNode[][], options: Readonly<ResolvedWakabamarkEngineOptions>): string {
  return lines.map(line => `&gt;${renderInlineLineHtml(line, options)}`).join('<br />');
}

function renderInlineLineHtml(line: InlineNode[], options: Readonly<ResolvedWakabamarkEngineOptions>): string {
  return line.map(node => renderInlineHtml(node, options)).join('');
}

function renderHtmlTextValue(value: string): string {
  return escapeHtml(value).replace(/\n/g, '<br />');
}

function renderInlineLineMarkdown(line: InlineNode[]): string {
  return line.map(renderInlineMarkdown).join('');
}

function renderListMarkdown(block: ListNode): string {
  return block.items
    .map((item, index) => {
      const marker = block.ordered ? `${index + 1}. ` : '- ';
      const continuationPrefix = ' '.repeat(marker.length);

      return item.lines
        .map((line, lineIndex) => {
          const prefix = lineIndex === 0 ? marker : continuationPrefix;

          return `${prefix}${renderInlineLineMarkdown(line)}`;
        })
        .join('\n');
    })
    .join('\n');
}

function renderBlockMarkdown(block: BlockNode): string {
  switch (block.type) {
    case 'paragraph':
      return block.children.map(renderInlineMarkdown).join('');
    case 'list':
      return renderListMarkdown(block);
    case 'blockquote':
      return block.lines.map(line => `>${renderInlineLineMarkdown(line)}`).join('\n');
    case 'code-block':
      return block.value
        .split('\n')
        .map(line => `    ${line}`)
        .join('\n');
  }
}

function renderInlineMarkdown(node: InlineNode): string {
  switch (node.type) {
    case 'text':
      return escapeMarkdownText(node.value);
    case 'emphasis':
      return `*${renderInlineChildrenMarkdown(node.children)}*`;
    case 'strong':
      return `**${renderInlineChildrenMarkdown(node.children)}**`;
    case 'underline':
      return `<u>${renderInlineChildrenMarkdown(node.children)}</u>`;
    case 'strikethrough':
      return `<s>${renderInlineChildrenMarkdown(node.children)}</s>`;
    case 'spoiler':
      return `<span class="wakabamark-spoiler">${renderInlineChildrenMarkdown(node.children)}</span>`;
    case 'superscript':
      return `<sup>${renderInlineChildrenMarkdown(node.children)}</sup>`;
    case 'subscript':
      return `<sub>${renderInlineChildrenMarkdown(node.children)}</sub>`;
    case 'code-span':
      return renderMarkdownCodeSpan(node.value);
    case 'link':
      return node.external && isMarkdownAutolinkSafe(node.href)
        ? `<${node.href}>`
        : `[${escapeMarkdownLinkText(node.text)}](${escapeMarkdownLinkDestination(node.href)})`;
    case 'post-reference':
      return `[>>${node.postId}](${escapeMarkdownLinkDestination(node.href)})`;
  }
}

function renderInlineChildrenMarkdown(children: InlineNode[]): string {
  return children.map(renderInlineMarkdown).join('');
}

function extractInlinePlainText(node: InlineNode): string {
  switch (node.type) {
    case 'text':
      return node.value;
    case 'emphasis':
    case 'strong':
    case 'underline':
    case 'strikethrough':
    case 'spoiler':
    case 'superscript':
    case 'subscript':
      return node.children.map(extractInlinePlainText).join('');
    case 'code-span':
      return node.value;
    case 'link':
      return node.text;
    case 'post-reference':
      return `>>${node.postId}`;
  }
}

function extractBlockPlainText(block: BlockNode): string {
  switch (block.type) {
    case 'paragraph':
      return block.children.map(extractInlinePlainText).join('');
    case 'list':
      return block.items
        .map(item => item.lines.map(line => line.map(extractInlinePlainText).join('')).join('\n'))
        .join('\n');
    case 'blockquote':
      return block.lines.map(extractBlockQuoteLinePlainText).join('\n');
    case 'code-block':
      return block.value;
  }
}

function extractBlockQuoteLinePlainText(line: InlineNode[]): string {
  const value = line.map(extractInlinePlainText).join('');

  return value.startsWith(' ') ? value.slice(1) : value;
}

function parseInline(input: string, options: Readonly<ResolvedWakabamarkEngineOptions>): InlineNode[] {
  const nodes: InlineNode[] = [];
  let cursor = 0;
  let textStart = 0;

  while (cursor < input.length) {
    const codeSpan = tryParseCodeSpan(input, cursor);
    if (codeSpan) {
      pushPendingText(nodes, input, textStart, cursor);
      nodes.push({ type: 'code-span', value: codeSpan.value });
      cursor = codeSpan.nextIndex;
      textStart = cursor;
      continue;
    }

    const pluginMatch = tryParseInlinePlugin(input, cursor, options);
    if (pluginMatch) {
      pushPendingText(nodes, input, textStart, cursor);
      nodes.push(...pluginMatch.nodes);
      cursor = pluginMatch.nextIndex;
      textStart = cursor;
      continue;
    }

    if (options.features.postReferences) {
      const postReference = tryParsePostReference(input, cursor, options);
      if (postReference) {
        pushPendingText(nodes, input, textStart, cursor);
        nodes.push(postReference.node);
        cursor = postReference.nextIndex;
        textStart = cursor;
        continue;
      }
    }

    const link = tryParseUrl(input, cursor, options);
    if (link) {
      pushPendingText(nodes, input, textStart, cursor);
      nodes.push(link.node);
      cursor = link.nextIndex;
      textStart = cursor;
      continue;
    }

    const bbcode = tryParseBbCode(input, cursor, options);
    if (bbcode) {
      pushPendingText(nodes, input, textStart, cursor);
      nodes.push(bbcode.node);
      cursor = bbcode.nextIndex;
      textStart = cursor;
      continue;
    }

    const strong = tryParseDelimitedText(input, cursor, ['**', '__'], options, 'strong');
    if (strong) {
      pushPendingText(nodes, input, textStart, cursor);
      nodes.push(strong.node);
      cursor = strong.nextIndex;
      textStart = cursor;
      continue;
    }

    const emphasis = tryParseDelimitedText(input, cursor, ['*', '_'], options, 'emphasis');
    if (emphasis) {
      pushPendingText(nodes, input, textStart, cursor);
      nodes.push(emphasis.node);
      cursor = emphasis.nextIndex;
      textStart = cursor;
      continue;
    }

    const spoiler = tryParseSpoiler(input, cursor, options);
    if (spoiler) {
      pushPendingText(nodes, input, textStart, cursor);
      nodes.push(spoiler.node);
      cursor = spoiler.nextIndex;
      textStart = cursor;
      continue;
    }

    cursor += 1;
  }

  pushPendingText(nodes, input, textStart, input.length);

  return mergeAdjacentTextNodes(nodes);
}

function tryParseInlinePlugin(
  input: string,
  start: number,
  options: Readonly<ResolvedWakabamarkEngineOptions>,
): { nodes: InlineNode[]; nextIndex: number } | null {
  for (const plugin of options.plugins) {
    const match = plugin.parseInline({
      input,
      start,
      features: options.features,
      resolvePostReferenceHref: options.resolvePostReferenceHref,
    });
    if (!match) {
      continue;
    }

    assertValidInlinePluginMatch(plugin.name, match, start, input.length, options);
    return match;
  }

  return null;
}

function tryParseParagraph(
  lines: string[],
  start: number,
  options: Readonly<ResolvedWakabamarkEngineOptions>,
): { node: ParagraphNode; nextIndex: number } {
  const paragraphLines: string[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index];
    if (line === undefined) {
      break;
    }

    if (isBlankLine(line) || isBlockOpeningLine(line)) {
      break;
    }

    paragraphLines.push(line.trim());
    index += 1;
  }

  return {
    node: {
      type: 'paragraph',
      children: parseInline(paragraphLines.join('\n'), options),
    },
    nextIndex: index,
  };
}

function tryParseBlockQuote(
  lines: string[],
  start: number,
  options: Readonly<ResolvedWakabamarkEngineOptions>,
): { node: BlockQuoteNode; nextIndex: number } | null {
  const startingLine = lines[start];
  if (startingLine === undefined || !isBlockQuoteLine(startingLine)) {
    return null;
  }

  const quoteLines: InlineNode[][] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index];
    if (line === undefined || !isBlockQuoteLine(line)) {
      break;
    }

    quoteLines.push(parseInline(line.slice(1), options));
    index += 1;
  }

  return {
    node: {
      type: 'blockquote',
      lines: quoteLines,
    },
    nextIndex: index,
  };
}

function tryParseCodeBlock(lines: string[], start: number): { node: CodeBlockNode; nextIndex: number } | null {
  const startingLine = lines[start];
  if (startingLine === undefined || !isIndentedCodeLine(startingLine)) {
    return null;
  }

  const codeLines: string[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index];
    if (line === undefined || !isIndentedCodeLine(line)) {
      break;
    }

    codeLines.push(line.startsWith('\t') ? line.slice(1) : line.slice(CODE_INDENT_WIDTH));
    index += 1;
  }

  return {
    node: {
      type: 'code-block',
      value: codeLines.join('\n'),
    },
    nextIndex: index,
  };
}

function tryParseList(
  lines: string[],
  start: number,
  options: Readonly<ResolvedWakabamarkEngineOptions>,
): { node: ListNode; nextIndex: number } | null {
  const startingLine = lines[start];
  if (startingLine === undefined) {
    return null;
  }

  const ordered = isOrderedListStartLine(startingLine);
  if (!ordered && !isUnorderedListLine(startingLine)) {
    return null;
  }

  const items: ListItemNode[] = [];
  let currentItemLines: string[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index];
    if (line === undefined) {
      break;
    }

    if (isBlankLine(line)) {
      break;
    }

    const itemMatch = ordered ? line.match(/^\d+\.\s+(.*)$/) : line.match(/^[*+-]\s+(.*)$/);
    if (itemMatch) {
      if (currentItemLines.length > 0) {
        items.push(buildListItem(currentItemLines, options));
      }

      currentItemLines = [itemMatch[1] ?? ''];
      index += 1;
      continue;
    }

    const continuationMatch = line.match(/^(?:\t| +)(.*)$/);
    if (continuationMatch && currentItemLines.length > 0) {
      currentItemLines.push(continuationMatch[1] ?? '');
      index += 1;
      continue;
    }

    break;
  }

  if (currentItemLines.length > 0) {
    items.push(buildListItem(currentItemLines, options));
  }

  return {
    node: {
      type: 'list',
      ordered,
      items,
    },
    nextIndex: index,
  };
}

function buildListItem(lines: string[], options: Readonly<ResolvedWakabamarkEngineOptions>): ListItemNode {
  return {
    type: 'list-item',
    lines: lines.map(line => parseInline(line, options)),
  };
}

function tryParseCodeSpan(input: string, start: number): { value: string; nextIndex: number } | null {
  if (input[start] !== '`') {
    return null;
  }

  let fenceLength = 1;
  while (input[start + fenceLength] === '`') {
    fenceLength += 1;
  }

  const fence = '`'.repeat(fenceLength);
  const closingIndex = input.indexOf(fence, start + fenceLength);
  if (closingIndex === -1) {
    return null;
  }

  return {
    value: input.slice(start + fenceLength, closingIndex),
    nextIndex: closingIndex + fenceLength,
  };
}

function tryParsePostReference(
  input: string,
  start: number,
  options: Readonly<ResolvedWakabamarkEngineOptions>,
): { node: PostReferenceNode; nextIndex: number } | null {
  if (!input.startsWith('>>', start) || input[start - 1] === '>' || input[start + 2] === '>') {
    return null;
  }

  const match = /^(>>)(\d+)/.exec(input.slice(start));
  if (!match) {
    return null;
  }

  const postId = match[2];
  if (postId === undefined) {
    return null;
  }

  const href = options.resolvePostReferenceHref(postId);
  if (!isSafePluginHref(href, options.allowedUrlProtocols)) {
    return null;
  }

  return {
    node: {
      type: 'post-reference',
      postId,
      href,
    },
    nextIndex: start + match[0].length,
  };
}

const AUTOLINK_PATTERN = /[a-z][a-z0-9+.-]{0,63}:\/\/[^\s<]+/iy;

function tryParseUrl(
  input: string,
  start: number,
  options: Readonly<ResolvedWakabamarkEngineOptions>,
): { node: LinkNode; nextIndex: number } | null {
  AUTOLINK_PATTERN.lastIndex = start;
  const match = AUTOLINK_PATTERN.exec(input);
  if (!match || match.index !== start) {
    return null;
  }

  const candidate = trimTrailingUrlPunctuation(match[0]);
  if (!candidate) {
    return null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(candidate);
  } catch {
    return null;
  }

  if (UNSAFE_URL_PROTOCOLS.has(parsedUrl.protocol)) {
    return null;
  }

  if (!options.allowedUrlProtocols.includes(parsedUrl.protocol)) {
    return null;
  }

  return {
    node: {
      type: 'link',
      href: candidate,
      text: candidate,
      external: true,
    },
    nextIndex: start + candidate.length,
  };
}

function tryParseDelimitedText(
  input: string,
  start: number,
  delimiters: readonly string[],
  options: Readonly<ResolvedWakabamarkEngineOptions>,
  type: EmphasisNode['type'] | StrongNode['type'],
): { node: EmphasisNode | StrongNode; nextIndex: number } | null {
  for (const delimiter of delimiters) {
    if (!input.startsWith(delimiter, start)) {
      continue;
    }

    const closingIndex = input.indexOf(delimiter, start + delimiter.length);
    if (closingIndex === -1 || closingIndex === start + delimiter.length) {
      continue;
    }

    const children = parseInline(input.slice(start + delimiter.length, closingIndex), options);

    if (type === 'strong') {
      return {
        node: {
          type: 'strong',
          children,
        },
        nextIndex: closingIndex + delimiter.length,
      };
    }

    return {
      node: {
        type: 'emphasis',
        children,
      },
      nextIndex: closingIndex + delimiter.length,
    };
  }

  return null;
}

function tryParseSpoiler(
  input: string,
  start: number,
  options: Readonly<ResolvedWakabamarkEngineOptions>,
): { node: SpoilerNode; nextIndex: number } | null {
  if (!options.features.spoilers || !input.startsWith(SPOILER_DELIMITER, start)) {
    return null;
  }

  const contentStart = start + SPOILER_DELIMITER.length;
  const closingIndex = input.indexOf(SPOILER_DELIMITER, contentStart);
  if (closingIndex === -1 || closingIndex === contentStart) {
    return null;
  }

  return {
    node: {
      type: 'spoiler',
      children: parseInline(input.slice(contentStart, closingIndex), options),
    },
    nextIndex: closingIndex + SPOILER_DELIMITER.length,
  };
}

function tryParseBbCode(
  input: string,
  start: number,
  options: Readonly<ResolvedWakabamarkEngineOptions>,
): { node: InlineContainerNode; nextIndex: number } | null {
  if (!options.features.bbCodes || input[start] !== '[') {
    return null;
  }

  const openingTag = tryParseBbCodeOpeningTag(input, start);
  if (!openingTag) {
    return null;
  }

  const closingIndex = findMatchingBbCodeClosingTag(input, openingTag.name, openingTag.nextIndex);
  if (closingIndex === -1) {
    return null;
  }

  const children = parseInline(input.slice(openingTag.nextIndex, closingIndex), options);

  return {
    node: {
      type: BBCODE_TO_NODE_TYPE[openingTag.name],
      children,
    },
    nextIndex: closingIndex + openingTag.name.length + 3,
  };
}

function tryParseBbCodeOpeningTag(
  input: string,
  start: number,
): { name: SupportedBbCodeTagName; nextIndex: number } | null {
  const match = /^\[([a-z]+)\]/i.exec(input.slice(start));
  const name = match?.[1]?.toLowerCase();
  if (!match || !isSupportedBbCodeTagName(name)) {
    return null;
  }

  return {
    name,
    nextIndex: start + match[0].length,
  };
}

function findMatchingBbCodeClosingTag(input: string, name: SupportedBbCodeTagName, start: number): number {
  const tagPattern = /\[(\/)?([a-z]+)\]/gi;
  tagPattern.lastIndex = start;
  let depth = 1;

  while (true) {
    const match = tagPattern.exec(input);
    const matchedName = match?.[2]?.toLowerCase();
    if (!match || !isSupportedBbCodeTagName(matchedName)) {
      return -1;
    }

    if (matchedName !== name) {
      continue;
    }

    if (match[1] === '/') {
      depth -= 1;
      if (depth === 0) {
        return match.index;
      }
      continue;
    }

    depth += 1;
  }
}

function isSupportedBbCodeTagName(value: string | undefined): value is SupportedBbCodeTagName {
  return value !== undefined && value in BBCODE_TO_NODE_TYPE;
}
