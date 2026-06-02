import {
	DEFAULT_ALLOWED_URL_PROTOCOLS,
	DEFAULT_EXTERNAL_LINK_REL,
	DEFAULT_EXTERNAL_LINK_TARGET,
	DEFAULT_SPOILER_CLASS_NAME,
} from './constants.js';

import type {
	InlineNode,
	ResolvedWakabamarkEngineOptions,
	WakabamarkEngineOptions,
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
	return /^>\s?/.test(line);
}

export function isBlockOpeningLine(line: string): boolean {
	return (
		isIndentedCodeLine(line) ||
		isUnorderedListLine(line) ||
		isOrderedListStartLine(line) ||
		isBlockQuoteLine(line)
	);
}

export function pushPendingText(
	nodes: InlineNode[],
	input: string,
	start: number,
	end: number,
): void {
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

export function resolveWakabamarkEngineOptions(
	options: WakabamarkEngineOptions = {},
): ResolvedWakabamarkEngineOptions {
	const profile = options.profile ?? 'official';
	const spoilersEnabledByProfile = profile === 'imageboard';

	return {
		allowedUrlProtocols: options.allowedUrlProtocols ?? [...DEFAULT_ALLOWED_URL_PROTOCOLS],
		profile,
		features: {
			postReferences: options.features?.postReferences ?? false,
			spoilers: options.features?.spoilers ?? spoilersEnabledByProfile,
		},
		html: {
			externalLinkRel: options.html?.externalLinkRel ?? DEFAULT_EXTERNAL_LINK_REL,
			externalLinkTarget: options.html?.externalLinkTarget ?? DEFAULT_EXTERNAL_LINK_TARGET,
			spoilerClassName: options.html?.spoilerClassName ?? DEFAULT_SPOILER_CLASS_NAME,
		},
		resolvePostReferenceHref:
			options.resolvePostReferenceHref ?? (postId => `#post-${postId}`),
	};
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
	return value.replace(/[\\`*_\[\]<]/g, match => `\\${match}`);
}

export function escapeMarkdownLinkText(value: string): string {
	return value.replace(/[\\\[\]]/g, match => `\\${match}`);
}

export function escapeMarkdownLinkDestination(value: string): string {
	return value.replace(/[()\s]/g, match => encodeURIComponent(match));
}

export function renderMarkdownCodeSpan(value: string): string {
	const maxBacktickRun = Math.max(
		...Array.from(value.matchAll(/`+/g), match => match[0].length),
		0,
	);
	const fence = '`'.repeat(maxBacktickRun + 1);

	return `${fence}${value}${fence}`;
}

export function trimTrailingUrlPunctuation(value: string): string {
	return value.replace(/[),.!?]+$/g, '');
}
