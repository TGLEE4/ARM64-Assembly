# Phase 5 — Instruction analysis coverage and regression tests

Apply this update only to the `develop` branch in `TGLEE4/ARM64-Assembly`.

## Install

Copy the ZIP contents into the repository root (merge directories; replace matching files). This update changes only the `src/analysis` modules and adds `scripts/test-analysis.cjs` and `tests/regression.cjs`. It does **not** replace the approved UI, sidebar, branding, or legacy toolkit.

Run in VS Code PowerShell:

```powershell
git branch --show-current
node scripts/test-analysis.cjs
npm run build
npm run dev
```

The branch should read `develop`. Do not push until tests and a browser smoke test pass.

## What's expanded

- Added beginner-friendly definitions for `LSL`, `UBFM`, `SBFM`, `BIC`, `MVN`, `NEG`, `CSEL`, `CSET`, `LDRSB`, `LDRSH`, `LDRSW`.
- Added step-by-step instruction walkthroughs for wide move, bitwise, shifting, multiplication, and conditional select forms.
- Added conservative value-flow evaluation for `MOVZ`, `MOVK`, `AND`, `ORR`, `EOR`, `LSL`, `LSR`, `ASR`, and `MUL` when operand values are known.
- Fixed signed hexadecimal immediate interpretation (`#-0x20`), which JavaScript's BigInt parser doesn't accept directly.
- Unknown register/memory inputs remain unknown; branches and unsupported forms remain boundaries.
- Added 27 automated regression tests using the built-in Node test runner.

## Scope limitations

This is not a binary decoder, fully validating assembler, or an ARM64 emulator. Only instruction forms explicitly modeled by the limited evaluator are computed. Results should not be treated as execution evidence. These are static analyses of supplied assembly text; instruction effects for unrecognized forms are deliberately not inferred.

## Test examples

```asm
MOVZ X0, #0x1234
MOVK X0, #0xABCD, LSL #16
EOR X1, X0, #0xFF
```

```asm
MOV W0, #15
AND W1, W0, #3
LSL W2, W1, #2
```

The existing stylesheet, favicon, and navigation stay unchanged.
