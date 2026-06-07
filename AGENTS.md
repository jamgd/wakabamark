# Wakabamark

## Overview

- Small TypeScript library that parses WakabaMark into a typed AST and renders both HTML and Markdown from that AST.
- Public entrypoint is `src/index.ts`; keep it as re-exports only.
- Main implementation is split by role: `src/engine.ts`, `src/types.ts`, `src/constants.ts`, `src/utils.ts`.

## Commands

- `yarn test` — run unit tests through native `node --test` with runtime transpilation via `tsx`.
- `yarn typecheck` — strict TS validation.
- `yarn build` — clears `dist/` and rebuilds with `tsc --build`.
- `yarn build:demo` — rebuild the browser demo into `demo/dist/` with esbuild.

## Non-obvious constraints

- TS runs in `module: nodenext`; keep `.js` extensions in TS import/export specifiers.
- `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are enabled; parser code must narrow array and regex access explicitly.

## Demo app

- Built files live in `demo/dist/`; `yarn build:demo` removes and recreates that folder.
- Keep demo code browser-only. Do not introduce Node-only APIs or imports there.
- `yarn typecheck` includes `tsconfig.demo.json`; demo type errors fail static analysis CI.

## Parser invariants

- Preserve the AST-first design. Do not introduce direct regex-to-HTML rendering shortcuts.
- HTML and Markdown should stay semantically aligned because both are rendered from the same AST.
- Raw input HTML must stay escaped.
- Unsafe URL schemes must never become links, even if a caller includes them in `allowedUrlProtocols`.
- Code spans and indented code blocks must suppress further inline formatting.
- `features.postReferences` is opt-in.
- `features.spoilers` is opt-in.
- `features.bbCodes` is opt-in.
- Supported BBCode tags are `[B]`, `[I]`, `[U]`, `[S]`, `[SPOILER]`, `[SUP]`, and `[SUB]`.
- BBCode tags are case-insensitive and support mixed-case opening and closing tags.
- Mixed nesting is supported in both directions between classic inline syntax and BBCode.
- Markdown renders spoilers as raw HTML `<span class="wakabamark-spoiler">...</span>`.
- Markdown also renders underline, strikethrough, superscript, and subscript as raw HTML tags.
- `%%spoiler%%` and `[SPOILER]...[/SPOILER]` share the same spoiler node/rendering.
- Malformed or unclosed BBCode must fall back to literal text.
- `[I][text/I]` is invalid syntax and must not be treated as a compatibility form.
- `WakabamarkEnginePlugin` is inline-only in v1 and may emit only built-in inline nodes.
- Plugin-built inline container nodes may contain nested built-in inline nodes.
- Core, not plugins, owns escaping and href safety checks for plugin output.

## Change checklist

- Update README when public API, defaults, or supported syntax change.
- Add or update focused `node:test` coverage for every syntax or safety behavior change.
- If you change output shape, verify both HTML and Markdown expectations.
