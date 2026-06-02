import { UNSAFE_URL_PROTOCOLS } from './constants.js';
import {
	escapeHtml,
	escapeHtmlAttribute,
	escapeMarkdownLinkDestination,
	escapeMarkdownLinkText,
	escapeMarkdownText,
	isBlankLine,
	isBlockOpeningLine,
	isBlockQuoteLine,
	isIndentedCodeLine,
	isOrderedListStartLine,
	isUnorderedListLine,
	mergeAdjacentTextNodes,
	normalizeInput,
	pushPendingText,
	renderMarkdownCodeSpan,
	resolveWakabamarkEngineOptions,
	trimTrailingUrlPunctuation,
} from './utils.js';

import type {
	BlockNode,
	BlockQuoteNode,
	CodeBlockNode,
	EmphasisNode,
	InlineNode,
	LinkNode,
	ListItemNode,
	ListNode,
	ParagraphNode,
	PostReferenceNode,
	ResolvedWakabamarkEngineOptions,
	SpoilerNode,
	StrongNode,
	TextNode,
	WakabamarkAst,
	WakabamarkEngineOptions,
} from './types.js';

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

	public html(input: string): string {
		return this.renderHtml(input);
	}

	public markdown(input: string): string {
		return this.renderMarkdown(input);
	}

	public ast(input: string): WakabamarkAst {
		return this.parse(input);
	}

	public extractPlainText(input: string | WakabamarkAst): string {
		const ast = typeof input === 'string' ? this.parse(input) : input;

		return ast.children.map(extractBlockPlainText).join('\n\n');
	}
}

function parseBlocks(
	input: string,
	options: Readonly<ResolvedWakabamarkEngineOptions>,
): BlockNode[] {
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

function renderBlockHtml(
	block: BlockNode,
	options: Readonly<ResolvedWakabamarkEngineOptions>,
): string {
	switch (block.type) {
		case 'paragraph':
			return `<p>${block.children.map(node => renderInlineHtml(node, options)).join('')}</p>`;
		case 'list': {
			const tag = block.ordered ? 'ol' : 'ul';
			const items = block.items
				.map(item => `<li>${renderInlineLinesHtml(item.lines, options)}</li>`)
				.join('');

			return `<${tag}>${items}</${tag}>`;
		}
		case 'blockquote':
			return `<blockquote><p>${renderInlineLinesHtml(block.lines, options)}</p></blockquote>`;
		case 'code-block':
			return `<pre><code>${escapeHtml(block.value)}</code></pre>`;
	}
}

function renderInlineHtml(
	node: InlineNode,
	options: Readonly<ResolvedWakabamarkEngineOptions>,
): string {
	switch (node.type) {
		case 'text':
			return escapeHtml(node.value);
		case 'emphasis':
			return `<em>${node.children.map(renderTextChildHtml).join('')}</em>`;
		case 'strong':
			return `<strong>${node.children.map(renderTextChildHtml).join('')}</strong>`;
		case 'spoiler':
			return `<span class="${escapeHtmlAttribute(options.html.spoilerClassName)}">${node.children.map(renderTextChildHtml).join('')}</span>`;
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

function renderBlockMarkdown(block: BlockNode): string {
	switch (block.type) {
		case 'paragraph':
			return block.children.map(renderInlineMarkdown).join('');
		case 'list':
			return renderListMarkdown(block);
		case 'blockquote':
			return block.lines.map(line => `> ${renderInlineLineMarkdown(line)}`).join('\n');
		case 'code-block':
			return block.value.split('\n').map(line => `    ${line}`).join('\n');
	}
}

function renderInlineMarkdown(node: InlineNode): string {
	switch (node.type) {
		case 'text':
			return escapeMarkdownText(node.value);
		case 'emphasis':
			return `*${node.children.map(renderTextChildMarkdown).join('')}*`;
		case 'strong':
			return `**${node.children.map(renderTextChildMarkdown).join('')}**`;
		case 'spoiler':
			return `>!${node.children.map(renderTextChildMarkdown).join('')}!<`;
		case 'code-span':
			return renderMarkdownCodeSpan(node.value);
		case 'link':
			return node.external
				? `<${node.href}>`
				: `[${escapeMarkdownLinkText(node.text)}](${escapeMarkdownLinkDestination(node.href)})`;
		case 'post-reference':
			return `[>>${node.postId}](${escapeMarkdownLinkDestination(node.href)})`;
	}
}

function renderTextChildHtml(node: TextNode): string {
	return escapeHtml(node.value);
}

function renderTextChildMarkdown(node: TextNode): string {
	return escapeMarkdownText(node.value);
}

function extractInlinePlainText(node: InlineNode): string {
	switch (node.type) {
		case 'text':
			return node.value;
		case 'emphasis':
		case 'strong':
		case 'spoiler':
			return node.children.map(child => child.value).join('');
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
			return block.lines.map(line => line.map(extractInlinePlainText).join('')).join('\n');
		case 'code-block':
			return block.value;
	}
}

function renderInlineLinesHtml(
	lines: InlineNode[][],
	options: Readonly<ResolvedWakabamarkEngineOptions>,
): string {
	return lines.map(line => renderInlineLineHtml(line, options)).join('<br />');
}

function renderInlineLineHtml(
	line: InlineNode[],
	options: Readonly<ResolvedWakabamarkEngineOptions>,
): string {
	return line.map(node => renderInlineHtml(node, options)).join('');
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

function parseInline(
	input: string,
	options: Readonly<ResolvedWakabamarkEngineOptions>,
): InlineNode[] {
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

		const strong = tryParseDelimitedText(input, cursor, ['**', '__'], 'strong');
		if (strong) {
			pushPendingText(nodes, input, textStart, cursor);
			nodes.push(strong.node);
			cursor = strong.nextIndex;
			textStart = cursor;
			continue;
		}

		const emphasis = tryParseDelimitedText(input, cursor, ['*', '_'], 'emphasis');
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
			children: parseInline(paragraphLines.join(' '), options),
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

		quoteLines.push(parseInline(line.replace(/^>\s?/, ''), options));
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

function tryParseCodeBlock(
	lines: string[],
	start: number,
): { node: CodeBlockNode; nextIndex: number } | null {
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

		codeLines.push(line.startsWith('\t') ? line.slice(1) : line.slice(4));
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

function buildListItem(
	lines: string[],
	options: Readonly<ResolvedWakabamarkEngineOptions>,
): ListItemNode {
	return {
		type: 'list-item',
		lines: lines.map(line => parseInline(line, options)),
	};
}

function tryParseCodeSpan(
	input: string,
	start: number,
): { value: string; nextIndex: number } | null {
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
	if (!input.startsWith('>>', start)) {
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

	return {
		node: {
			type: 'post-reference',
			postId,
			href: options.resolvePostReferenceHref(postId),
		},
		nextIndex: start + match[0].length,
	};
}

function tryParseUrl(
	input: string,
	start: number,
	options: Readonly<ResolvedWakabamarkEngineOptions>,
): { node: LinkNode; nextIndex: number } | null {
	const match = /^[a-z][a-z0-9+.-]*:\/\/[^\s<]+/i.exec(input.slice(start));
	if (!match) {
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

		const value = input.slice(start + delimiter.length, closingIndex);
		const textChild: TextNode = { type: 'text', value };

		if (type === 'strong') {
			return {
				node: {
					type: 'strong',
					children: [textChild],
				},
				nextIndex: closingIndex + delimiter.length,
			};
		}

		return {
			node: {
				type: 'emphasis',
				children: [textChild],
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
	if (!options.features.spoilers || !input.startsWith('%%', start)) {
		return null;
	}

	const closingIndex = input.indexOf('%%', start + 2);
	if (closingIndex === -1 || closingIndex === start + 2) {
		return null;
	}

	return {
		node: {
			type: 'spoiler',
			children: [
				{
					type: 'text',
					value: input.slice(start + 2, closingIndex),
				},
			],
		},
		nextIndex: closingIndex + 2,
	};
}
