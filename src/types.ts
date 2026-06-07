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
  | UnderlineNode
  | StrikethroughNode
  | SpoilerNode
  | SuperscriptNode
  | SubscriptNode
  | CodeSpanNode
  | LinkNode
  | PostReferenceNode;

export type InlineContainerNode =
  | EmphasisNode
  | StrongNode
  | UnderlineNode
  | StrikethroughNode
  | SpoilerNode
  | SuperscriptNode
  | SubscriptNode;

export type TextNode = {
  type: 'text';
  value: string;
};

export type EmphasisNode = {
  type: 'emphasis';
  children: InlineNode[];
};

export type StrongNode = {
  type: 'strong';
  children: InlineNode[];
};

export type UnderlineNode = {
  type: 'underline';
  children: InlineNode[];
};

export type StrikethroughNode = {
  type: 'strikethrough';
  children: InlineNode[];
};

export type SpoilerNode = {
  type: 'spoiler';
  children: InlineNode[];
};

export type SuperscriptNode = {
  type: 'superscript';
  children: InlineNode[];
};

export type SubscriptNode = {
  type: 'subscript';
  children: InlineNode[];
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

export type WakabamarkFeatureOptions = {
  postReferences?: boolean;
  spoilers?: boolean;
  bbCodes?: boolean;
};

export type WakabamarkInlinePluginContext = {
  input: string;
  start: number;
  features: Readonly<{
    postReferences: boolean;
    spoilers: boolean;
    bbCodes: boolean;
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
  parseInline: (context: WakabamarkInlinePluginContext) => WakabamarkInlinePluginMatch | null;
};

export type ResolvedWakabamarkEnginePlugin = {
  name: string;
  priority: number;
  parseInline: (context: WakabamarkInlinePluginContext) => WakabamarkInlinePluginMatch | null;
};

export type WakabamarkHtmlOptions = {
  blockquoteClassName?: string;
  externalLinkRel?: string;
  externalLinkTarget?: string | null;
  spoilerClassName?: string;
};

export type WakabamarkEngineOptions = {
  allowedUrlProtocols?: string[];
  features?: WakabamarkFeatureOptions;
  html?: WakabamarkHtmlOptions;
  maxInlineNestingDepth?: number;
  plugins?: readonly WakabamarkEnginePlugin[];
  resolvePostReferenceHref?: (postId: string) => string;
};

export type ResolvedWakabamarkEngineOptions = {
  allowedUrlProtocols: string[];
  features: {
    postReferences: boolean;
    spoilers: boolean;
    bbCodes: boolean;
  };
  html: {
    blockquoteClassName: string;
    externalLinkRel: string;
    externalLinkTarget: string | null;
    spoilerClassName: string;
  };
  maxInlineNestingDepth: number;
  plugins: readonly ResolvedWakabamarkEnginePlugin[];
  resolvePostReferenceHref: (postId: string) => string;
};
