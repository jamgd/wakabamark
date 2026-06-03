# WakabaMark engine

Embeddable [WakabaMark](https://wakaba.c3.cx/docs/docs.html#WakabaMark) engine with safe HTML and Markdown output.

- Official-style inline syntax: emphasis, strong, code spans, autolinks, optional post references
- Official-style block syntax: paragraphs, unordered lists, ordered lists, blockquotes, indented code blocks
- Single newlines inside a paragraph are preserved as line breaks in HTML output
- Markdown output from the same AST as HTML output
- Opt-in spoiler support
- Inline plugin support through `WakabamarkEnginePlugin`
- Hard denylist for unsafe URL schemes such as `javascript:`

## Usage

```ts
import { WakabamarkEngine } from 'wakabamark';

const engine = new WakabamarkEngine({
	features: {
		postReferences: true,
		spoilers: true,
	},
	resolvePostReferenceHref: postId => `/thread/42#reply-${postId}`,
});

const html = engine.renderHtml('%%secret%% >>123');
const markdown = engine.renderMarkdown('%%secret%% >>123');
```

## Plugins

Plugins are currently inline-only. A `WakabamarkEnginePlugin` may recognize custom syntax in `parseInline()` and return built-in inline nodes such as `text`, `strong`, `link`, or `code-span`.

```ts
import {
	WakabamarkEngine,
	type WakabamarkEnginePlugin,
} from 'wakabamark';

const mentionPlugin: WakabamarkEnginePlugin = {
	name: 'mentions',
	parseInline: ({ input, start }) => {
		const match = /^@([a-z0-9_]+)/i.exec(input.slice(start));
		const username = match?.[1];
		if (!match || username === undefined) {
			return null;
		}

		return {
			nodes: [
				{
					type: 'link',
					href: `/users/${username.toLowerCase()}`,
					text: `@${username}`,
					external: false,
				},
			],
			nextIndex: start + match[0].length,
		};
	},
};

const engine = new WakabamarkEngine({
	plugins: [mentionPlugin],
});
```

Current plugin constraints:

- Plugins run after built-in code-span parsing and before other built-in inline rules.
- Plugins may emit only built-in inline nodes in v1.
- Plugin-generated links are still checked against the unsafe-scheme denylist.
- Plugins do not run inside code spans.

## API

```ts
class WakabamarkEngine {
	constructor(options?: WakabamarkEngineOptions);

	parse(input: string): WakabamarkAst;
	renderHtml(input: string | WakabamarkAst): string;
	renderMarkdown(input: string | WakabamarkAst): string;
	extractPlainText(input: string | WakabamarkAst): string;
}
```

## Options

- `features.postReferences`: enable or disable `>>123` post-reference parsing, disabled by default
- `features.spoilers`: enable or disable `%%spoiler%%`, disabled by default
- `resolvePostReferenceHref(postId)`: customize the href for `>>123` when post-reference parsing is enabled
- `plugins`: register `WakabamarkEnginePlugin[]` for custom inline syntax
- `allowedUrlProtocols`: allowed external protocols, still filtered by an internal unsafe-scheme denylist
- `html.externalLinkRel`: customize `rel` for external links
- `html.externalLinkTarget`: customize `target` for external links
- `html.blockquoteClassName`: customize the blockquote class name in HTML output
- `html.spoilerClassName`: customize the spoiler class name in HTML output

## Security model

- **HTML output is the security boundary.** Input is escaped at every render leaf, so the HTML is safe to embed directly.
- **Markdown output is for storage and round-tripping, not sanitization.** Its safety depends entirely on the downstream renderer, so always render it with a trusted, sanitizing CommonMark renderer before display.
- Raw HTML from input is escaped, not passed through.
- HTML and Markdown are rendered from a typed AST, not by direct regex-to-HTML substitution.
- Dangerous protocols are never linkified, even if they are explicitly listed in `allowedUrlProtocols`.
- Plugin output is validated before it enters the AST; unsafe hrefs and unsupported node types are rejected.
- Code spans and indented code blocks bypass further inline formatting.

## Markdown round-trip

Markdown output escapes inline constructs, but it does **not** escape line-leading block markers such as `>`, `#`, `|`, `~`, or a leading `-`/`1.`. A downstream CommonMark renderer may therefore reinterpret some text as a blockquote, heading, table, or list. This is a fidelity limitation rather than a security one (HTML is the security boundary); if exact round-tripping matters, render the Markdown only with a renderer whose behavior you control.

## Development

```sh
yarn test
yarn typecheck
yarn build
```
