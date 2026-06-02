# Wakabamark

## Overview

- Small TypeScript library that parses WakabaMark into a typed AST and renders both HTML and Markdown from that AST.
- Public entrypoint is `src/index.ts`; keep it as re-exports only.
- Main implementation is split by role: `src/engine.ts`, `src/types.ts`, `src/constants.ts`, `src/utils.ts`.

## Commands

- `yarn test` — run unit tests through native `node --test` with runtime transpilation via `tsx`.
- `yarn typecheck` — strict TS validation.
- `yarn build` — clears `dist/` and rebuilds with `tsc --build`.

## Non-obvious constraints

- TS runs in `module: nodenext`; keep `.js` extensions in TS import/export specifiers.
- `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are enabled; parser code must narrow array and regex access explicitly.

## Parser invariants

- Preserve the AST-first design. Do not introduce direct regex-to-HTML rendering shortcuts.
- HTML and Markdown should stay semantically aligned because both are rendered from the same AST.
- Raw input HTML must stay escaped.
- Unsafe URL schemes must never become links, even if a caller includes them in `allowedUrlProtocols`.
- Code spans and indented code blocks must suppress further inline formatting.
- `features.postReferences` is opt-in.

## Change checklist

- Update README when public API, defaults, or supported syntax change.
- Add or update focused `node:test` coverage for every syntax or safety behavior change.
- If you change output shape, verify both HTML and Markdown expectations.
