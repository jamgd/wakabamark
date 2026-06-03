import {
  DEFAULT_ALLOWED_URL_PROTOCOLS,
  DEFAULT_BLOCKQUOTE_CLASS_NAME,
  DEFAULT_EXTERNAL_LINK_REL,
  DEFAULT_EXTERNAL_LINK_TARGET,
  DEFAULT_SPOILER_CLASS_NAME,
  UNSAFE_URL_PROTOCOLS,
} from './constants.js';
import type {
  InlineNode,
  ResolvedWakabamarkEngineOptions,
  ResolvedWakabamarkEnginePlugin,
  TextNode,
  WakabamarkEngineOptions,
  WakabamarkEnginePlugin,
  WakabamarkInlinePluginMatch,
} from './types.js';

export function normalizeInput(input: string): string {
  return input.replace(/\r\n?/g, '\n');
}

export function isBlankLine(line: string | undefined): boolean {
  return line === undefined || line.trim() === '';
}

export function isIndentedCodeLine(line: string): boolean {
  return line.startsWith('\t') || line.startsWith('    ');
}

export function isUnorderedListLine(line: string): boolean {
  return /^[*+-]\s+/.test(line);
}

export function isOrderedListStartLine(line: string): boolean {
  return /^1\.\s+/.test(line);
}

export function isBlockQuoteLine(line: string): boolean {
  return line.startsWith('>') && line[1] !== '>';
}

export function isBlockOpeningLine(line: string): boolean {
  return (
    isIndentedCodeLine(line) || isUnorderedListLine(line) || isOrderedListStartLine(line) || isBlockQuoteLine(line)
  );
}

export function pushPendingText(nodes: InlineNode[], input: string, start: number, end: number): void {
  if (start >= end) {
    return;
  }

  nodes.push({
    type: 'text',
    value: input.slice(start, end),
  });
}

export function mergeAdjacentTextNodes(nodes: InlineNode[]): InlineNode[] {
  const merged: InlineNode[] = [];

  for (const node of nodes) {
    const previous = merged.at(-1);
    if (previous?.type === 'text' && node.type === 'text') {
      previous.value += node.value;
      continue;
    }

    merged.push(node);
  }

  return merged;
}

export function resolveWakabamarkEngineOptions(options: WakabamarkEngineOptions = {}): ResolvedWakabamarkEngineOptions {
  return {
    allowedUrlProtocols: options.allowedUrlProtocols ?? [...DEFAULT_ALLOWED_URL_PROTOCOLS],
    features: {
      postReferences: options.features?.postReferences ?? false,
      spoilers: options.features?.spoilers ?? false,
    },
    html: {
      blockquoteClassName: options.html?.blockquoteClassName ?? DEFAULT_BLOCKQUOTE_CLASS_NAME,
      externalLinkRel: options.html?.externalLinkRel ?? DEFAULT_EXTERNAL_LINK_REL,
      externalLinkTarget: options.html?.externalLinkTarget ?? DEFAULT_EXTERNAL_LINK_TARGET,
      spoilerClassName: options.html?.spoilerClassName ?? DEFAULT_SPOILER_CLASS_NAME,
    },
    plugins: resolveWakabamarkEnginePlugins(options.plugins),
    resolvePostReferenceHref: options.resolvePostReferenceHref ?? (postId => `#post-${postId}`),
  };
}

function resolveWakabamarkEnginePlugins(
  plugins: readonly WakabamarkEnginePlugin[] | undefined,
): readonly ResolvedWakabamarkEnginePlugin[] {
  if (!plugins || plugins.length === 0) {
    return [];
  }

  const seenNames = new Set<string>();
  const resolvedPlugins = plugins.map(plugin => {
    const name = plugin.name.trim();
    if (name === '') {
      throw new Error('Plugin name must not be empty.');
    }

    if (seenNames.has(name)) {
      throw new Error(`Plugin names must be unique. Duplicate plugin name "${name}".`);
    }
    seenNames.add(name);

    const priority = plugin.priority ?? 0;
    if (!Number.isFinite(priority)) {
      throw new Error(`Plugin "${name}" has an invalid priority.`);
    }

    return {
      name,
      priority,
      parseInline: plugin.parseInline,
    };
  });

  resolvedPlugins.sort((left, right) => {
    const priorityDiff = right.priority - left.priority;
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return left.name.localeCompare(right.name);
  });

  return resolvedPlugins;
}

export function assertValidInlinePluginMatch(
  pluginName: string,
  match: WakabamarkInlinePluginMatch,
  start: number,
  inputLength: number,
  options: Readonly<ResolvedWakabamarkEngineOptions>,
): void {
  if (!Array.isArray(match.nodes)) {
    throw new Error(`Plugin "${pluginName}" returned an invalid nodes array.`);
  }

  if (match.nextIndex <= start) {
    throw new Error(
      `Plugin "${pluginName}" returned nextIndex ${match.nextIndex}, but it must advance past start ${start}.`,
    );
  }

  if (match.nextIndex > inputLength) {
    throw new Error(
      `Plugin "${pluginName}" returned nextIndex ${match.nextIndex}, which is beyond the input length ${inputLength}.`,
    );
  }

  for (const node of match.nodes) {
    assertValidInlineNode(pluginName, node, options);
  }
}

function assertValidInlineNode(
  pluginName: string,
  node: unknown,
  options: Readonly<ResolvedWakabamarkEngineOptions>,
): void {
  if (typeof node !== 'object' || node === null || typeof (node as { type?: unknown }).type !== 'string') {
    throw new Error(`Plugin "${pluginName}" returned an invalid inline node.`);
  }

  const typedNode = node as { type: string };

  switch (typedNode.type) {
    case 'text':
      if (typeof (node as { value?: unknown }).value !== 'string') {
        throw new Error(`Plugin "${pluginName}" returned a text node without a string value.`);
      }
      return;
    case 'emphasis':
    case 'strong':
    case 'spoiler':
      assertValidTextChildren(pluginName, (node as { children?: TextNode[] }).children, typedNode.type);
      return;
    case 'code-span':
      if (typeof (node as { value?: unknown }).value !== 'string') {
        throw new Error(`Plugin "${pluginName}" returned a code-span node without a string value.`);
      }
      return;
    case 'link':
      if (
        typeof (node as { href?: unknown }).href !== 'string' ||
        typeof (node as { text?: unknown }).text !== 'string' ||
        typeof (node as { external?: unknown }).external !== 'boolean'
      ) {
        throw new Error(`Plugin "${pluginName}" returned an invalid link node.`);
      }

      if (!isSafePluginHref((node as { href: string }).href, options.allowedUrlProtocols)) {
        throw new Error(`Plugin "${pluginName}" produced an unsafe href "${(node as { href: string }).href}".`);
      }
      return;
    case 'post-reference':
      if (
        typeof (node as { href?: unknown }).href !== 'string' ||
        typeof (node as { postId?: unknown }).postId !== 'string'
      ) {
        throw new Error(`Plugin "${pluginName}" returned an invalid post-reference node.`);
      }

      if (!isSafePluginHref((node as { href: string }).href, options.allowedUrlProtocols)) {
        throw new Error(`Plugin "${pluginName}" produced an unsafe href "${(node as { href: string }).href}".`);
      }
      return;
  }

  throw new Error(
    `Plugin "${pluginName}" returned an unsupported inline node type "${typedNode.type}". Plugins may only emit built-in inline nodes in this version.`,
  );
}

function assertValidTextChildren(
  pluginName: string,
  children: unknown,
  nodeType: 'emphasis' | 'strong' | 'spoiler',
): void {
  if (!Array.isArray(children)) {
    throw new Error(`Plugin "${pluginName}" returned a ${nodeType} node without text children.`);
  }

  for (const child of children) {
    if (!isTextNode(child)) {
      throw new Error(`Plugin "${pluginName}" returned a ${nodeType} node with a non-text child.`);
    }
  }
}

function isTextNode(node: unknown): node is TextNode {
  return (
    typeof node === 'object' &&
    node !== null &&
    (node as { type?: unknown }).type === 'text' &&
    typeof (node as { value?: unknown }).value === 'string'
  );
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }

  return false;
}

export function isSafePluginHref(href: string, allowedUrlProtocols: readonly string[]): boolean {
  if (href.trim() !== href || href === '') {
    return false;
  }

  // Browsers strip ASCII tab/newline/CR while resolving URLs, so a value such as "java\tscript:"
  // would re-form "javascript:" once the stripped control char is gone. Reject all C0 controls +
  // DEL before the scheme test, which would otherwise misclassify these as harmless relative URLs.
  if (hasControlCharacter(href)) {
    return false;
  }

  // Protocol-relative URLs ("//host/...") carry no scheme, so the checks below never see them,
  // yet they navigate off-origin. Treat them as unsafe rather than as a harmless relative path.
  if (href.startsWith('//')) {
    return false;
  }

  if (!/^[a-z][a-z0-9+.-]*:/i.test(href)) {
    return true;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(href);
  } catch {
    return false;
  }

  if (UNSAFE_URL_PROTOCOLS.has(parsedUrl.protocol)) {
    return false;
  }

  return allowedUrlProtocols.includes(parsedUrl.protocol);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value);
}

export function escapeMarkdownText(value: string): string {
  return value.replace(/[\\`*_[\]<]/g, match => `\\${match}`);
}

export function escapeMarkdownLinkText(value: string): string {
  return value.replace(/[\\[\]]/g, match => `\\${match}`);
}

export function escapeMarkdownLinkDestination(value: string): string {
  return value.replace(/[()\s]/g, match => encodeURIComponent(match));
}

// A Markdown `<...>` autolink terminates at the first ">" and may not contain "<", ">", spaces, or
// control characters. When the href would break that form, the caller should emit "[text](dest)".
export function isMarkdownAutolinkSafe(href: string): boolean {
  for (let index = 0; index < href.length; index += 1) {
    const code = href.charCodeAt(index);
    if (code <= 0x20 || code === 0x3c || code === 0x3e || code === 0x7f) {
      return false;
    }
  }

  return true;
}

export function renderMarkdownCodeSpan(value: string): string {
  // Fold instead of Math.max(...array): spreading hundreds of thousands of backtick-run lengths can
  // exceed the engine's argument limit and throw a RangeError.
  let maxBacktickRun = 0;
  for (const match of value.matchAll(/`+/g)) {
    maxBacktickRun = Math.max(maxBacktickRun, match[0].length);
  }

  const fence = '`'.repeat(maxBacktickRun + 1);

  return `${fence}${value}${fence}`;
}

export function trimTrailingUrlPunctuation(value: string): string {
  return value.replace(/[),.!?]+$/g, '');
}
