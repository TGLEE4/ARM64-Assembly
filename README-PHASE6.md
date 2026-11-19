# Phase 6 — Instruction Relationship Analysis

This package applies on top of Phase 5 on the `develop` branch.
It does **not** change the approved sidebar, logo, `App.tsx`, or legacy toolkit.

## Included

- `src/analysis/relationships.ts` — conservative straight-line dependency analysis
- `src/pages/Explain.tsx` — adds an Instruction relationships panel inside Explain
- `src/styles/relationships.css` — styles the panel to match the slate/amber/teal design
- `scripts/test-analysis.cjs` — TypeScript 6 compatible runner, including CommonJS isolation
- `tests/relationships.cjs` — 12 new relationship tests

The existing `tests/regression.cjs` (27 tests) must remain in the repository.
The package does not replace the Phase 5 analysis modules.

## Apply

1. Ensure `git branch --show-current` returns `develop`.
2. Extract this ZIP **into the repository root**, preserving the `src/`, `scripts/`, and `tests/` paths.
3. Run `node scripts/test-analysis.cjs` (expected: 39 tests pass).
4. Run `npm run build`.
5. Run `npm run dev` and test the native Explain page.
6. Review the diff and commit to `develop` only after local checks pass.

## Suggested test sequence

```asm
LDR W8, [X19, #0x200]
CMP W8, #0
B.EQ target
MOV W0, #1
RET
```

Expected: line 2 depends on line 1; line 3 depends on line 2; analysis stops at line 3. The LDR result remains **unknown**.

```asm
MOV W0, #4
ADD W1, W0, #8
CMP W1, #12
B.EQ done
```

Expected: known inputs show condition would be true; the tool must not claim that a runtime branch actually occurred.

## Limitations

The relationships module is **not** a debugger, complete emulator, or CFG engine. It follows a single syntactic sequence until a control-flow or unmodeled-instruction boundary. It models a deliberately limited set of instruction forms and does not fetch live memory or discover branch targets. Pasted text is treated as supplied evidence, not execution proof.
