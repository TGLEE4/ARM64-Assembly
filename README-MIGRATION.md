# ARM64 Toolkit - Design-preserving migration, stage 1

This is an overlay for the existing React/TypeScript/Vite repository. Do NOT replace `package.json`, `src/main.tsx`, or the `src/analysis` files created previously.

## Apply

1. Stop the Vite server with Ctrl+C (optional; Vite can hot reload).
2. Extract the archive into the `ARM64-Assembly` repository root, allowing overwrite for `src/App.tsx`, `src/App.css`, and `src/index.css`.
3. Make sure `public/legacy/toolkit.html` is present.
4. In VS Code terminal, run `npm run dev` if not running.
5. Navigate to http://localhost:5173/.

## What this stage gives you

- Exact original dark tool UI and layout, not a simulated recreation.
- Complete latest Explain (mnemonics + clickable operands).
- Existing Memory, Trace Lab, Disassembler, iOS / Unity, Projects and reference tools.
- Working Vite deployment as a standard multi-file project.

## Important

This stage displays the original HTML inside a same-origin iframe. This is a **temporary compatibility bridge**, not a full React rewrite. The independent React analysis modules already created are preserved but not yet connected to the embedded toolkit. Migrate one feature at a time with regression testing; do not delete `public/legacy/toolkit.html` until every feature has been ported.

Data already saved in browser localStorage on other origins (e.g., file://) does not transfer automatically. Export projects from the old page first and import into the new site if applicable.

## Proposed next extraction

1. Extract CSS variables/theme and navigation into React components.
2. Port Explain parser/decoder and mnemonic dictionary to `src/analysis` with tests.
3. Port clickable operand inspector.
4. Port other tools; remove bridge only after verification.
