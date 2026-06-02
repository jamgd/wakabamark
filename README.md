# WakabaMark engine

Embeddable [WakabaMark](https://wakaba.c3.cx/docs/docs.html#WakabaMark) engine with safe HTML and Markdown output.

- Official-style inline syntax: emphasis, strong, code spans, autolinks, optional post references
- Official-style block syntax: paragraphs, unordered lists, ordered lists, blockquotes, indented code blocks
- Markdown output from the same AST as HTML output
- Opt-in imageboard spoiler support
- Hard denylist for unsafe URL schemes such as `javascript:`

## Usage

```ts
import { WakabamarkEngine } from 'wakabamark';

const engine = new WakabamarkEngine({
	profile: 'imageboard',
	features: {
		postReferences: true,
	},
	resolvePostReferenceHref: postId => `/thread/42#reply-${postId}`,
});

const html = engine.renderHtml('%%secret%% >>123');
const markdown = engine.renderMarkdown('%%secret%% >>123');
```

## API

```ts
class WakabamarkEngine {
	constructor(options?: WakabamarkEngineOptions);

	parse(input: string): WakabamarkAst;
	renderHtml(input: string | WakabamarkAst): string;
	renderMarkdown(input: string | WakabamarkAst): string;
	html(input: string): string;
	markdown(input: string): string;
	ast(input: string): WakabamarkAst;
	extractPlainText(input: string | WakabamarkAst): string;
}
```

## Options

- `profile`: `'official' | 'imageboard'`
- `features.postReferences`: enable or disable `>>123` post-reference parsing, disabled by default
- `features.spoilers`: force-enable or disable `%%spoiler%%`
- `resolvePostReferenceHref(postId)`: customize the href for `>>123` when post-reference parsing is enabled
- `allowedUrlProtocols`: allowed external protocols, still filtered by an internal unsafe-scheme denylist
- `html.externalLinkRel`: customize `rel` for external links
- `html.externalLinkTarget`: customize `target` for external links
- `html.spoilerClassName`: customize the spoiler class name in HTML output

## Security model

- Raw HTML from input is escaped, not passed through.
- HTML and Markdown are rendered from a typed AST, not by direct regex-to-HTML substitution.
- Dangerous protocols are never linkified, even if they are explicitly listed in `allowedUrlProtocols`.
- Code spans and indented code blocks bypass further inline formatting.

## Development

```sh
yarn test
yarn typecheck
yarn build
```
