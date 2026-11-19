# ARM64 Toolkit — Phase 4 (cumulative Phase 3 + Phase 4 update)

## Apply on `develop` only

1. In VS Code, run `git branch --show-current` and verify it prints `develop`.
2. Extract this ZIP and copy its `src/` directory into the existing `ARM64-Assembly` repository, merging folders and replacing matching files.
3. Keep the existing `package.json`, `public/legacy/toolkit.html`, and other files unchanged.
4. Run `npm run build` and fix any reported errors before committing.
5. Run `npm run dev`, open the Vite local URL, and test the examples below.
6. When validated, run `git add src README-PHASE4.md`, `git commit -m "Expand ARM64 Explain CPU walkthroughs"`, `git push origin develop`. Do **not** merge to `main` until tested.

## Changes

- Carries forward Phase 3's wider two-column dashboard, selectable explanations, persistent operand inspector, and limited static value-flow tracking. This is intentional so Phase 3 installation is not a prerequisite.
- Adds a new standalone analysis module: `src/analysis/instructionGuide.ts`.
- Explains CPU steps, memory-access widths, address offsets, common pre-index and post-index behavior, register/flag reads and writes, and pseudocode.
- Adds **CPU steps / pseudocode** to Explain's explanation-topic controls (enabled by default).
- Retains the existing legacy toolkit link and dark visual design.

## Test examples

```
LDR W8, [X19, #0x200]
CMP W8, #0
B.EQ target
```

```
STR W0, [SP, #-16]!
LDR X0, [SP], #16
```

```
MOV W0, #4
ADD W1, W0, #8
CMP W1, #12
B.EQ done
```

## Safety / accuracy limits

- This is static **assembly-text interpretation**, not a process debugger, disassembler, comprehensive emulator, or verified function decompiler.
- Only specified instruction forms receive detailed execution steps; unsupported addressing forms explicitly state that their effective addresses are not evaluated.
- Numerical register and memory values are unknown unless supplied by supported prior instructions in the limited value-flow engine.
- Linear value flow stops at control-flow boundaries; do not treat following instructions as definitely executed.
- Binary decoding, Mach-O calculations, and the existing tools remain in the Legacy Toolkit.

## Validation performed while packaging

- Strict TypeScript compilation of the `src/analysis/*.ts` modules passed.
- Eight targeted Node.js assertions for parsing, arithmetic tracking, memory modes, and conservative unsupported behavior passed.
- A full React/Vite build was **not run in the packaging environment**; validate it using `npm run build` in your repository.
