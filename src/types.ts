export type DocumentNode = {
	type: 'document';
	children: BlockNode[];
};

export type BlockNode = ParagraphNode | ListNode | BlockQuoteNode | CodeBlockNode;

export type ParagraphNode = {
	type: 'paragraph';
	children: InlineNode[];
};

export type ListNode = {
	type: 'list';
	ordered: boolean;
	items: ListItemNode[];
};

export type ListItemNode = {
	type: 'list-item';
	lines: InlineNode[][];
};

export type BlockQuoteNode = {
	type: 'blockquote';
	lines: InlineNode[][];
};

export type CodeBlockNode = {
	type: 'code-block';
	value: string;
};

export type InlineNode =
	| TextNode
	| EmphasisNode
	| StrongNode
	| SpoilerNode
	| CodeSpanNode
	| LinkNode
	| PostReferenceNode;

export type TextNode = {
	type: 'text';
	value: string;
};

export type EmphasisNode = {
	type: 'emphasis';
	children: TextNode[];
};

export type StrongNode = {
	type: 'strong';
	children: TextNode[];
};

export type SpoilerNode = {
	type: 'spoiler';
	children: TextNode[];
};

export type CodeSpanNode = {
	type: 'code-span';
	value: string;
};

export type LinkNode = {
	type: 'link';
	href: string;
	text: string;
	external: boolean;
};

export type PostReferenceNode = {
	type: 'post-reference';
	postId: string;
	href: string;
};

export type WakabamarkAst = DocumentNode;

export type WakabamarkProfile = 'official' | 'imageboard';

export type WakabamarkFeatureOptions = {
	postReferences?: boolean;
	spoilers?: boolean;
};

export type WakabamarkInlinePluginContext = {
	input: string;
	start: number;
	profile: WakabamarkProfile;
	features: Readonly<{
		postReferences: boolean;
		spoilers: boolean;
	}>;
	resolvePostReferenceHref: (postId: string) => string;
};

export type WakabamarkInlinePluginMatch = {
	nodes: InlineNode[];
	nextIndex: number;
};

export type WakabamarkEnginePlugin = {
	name: string;
	priority?: number;
	parseInline: (
		context: WakabamarkInlinePluginContext,
	) => WakabamarkInlinePluginMatch | null;
};

export type ResolvedWakabamarkEnginePlugin = {
	name: string;
	priority: number;
	parseInline: (
		context: WakabamarkInlinePluginContext,
	) => WakabamarkInlinePluginMatch | null;
};

export type WakabamarkHtmlOptions = {
	externalLinkRel?: string;
	externalLinkTarget?: string | null;
	spoilerClassName?: string;
};

export type WakabamarkEngineOptions = {
	allowedUrlProtocols?: string[];
	profile?: WakabamarkProfile;
	features?: WakabamarkFeatureOptions;
	html?: WakabamarkHtmlOptions;
	plugins?: readonly WakabamarkEnginePlugin[];
	resolvePostReferenceHref?: (postId: string) => string;
};

export type ResolvedWakabamarkEngineOptions = {
	allowedUrlProtocols: string[];
	profile: WakabamarkProfile;
	features: {
		postReferences: boolean;
		spoilers: boolean;
	};
	html: {
		externalLinkRel: string;
		externalLinkTarget: string | null;
		spoilerClassName: string;
	};
	plugins: readonly ResolvedWakabamarkEnginePlugin[];
	resolvePostReferenceHref: (postId: string) => string;
};
