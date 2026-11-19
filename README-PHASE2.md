# Phase 2: Native React Explain (design-preserving overlay)

## Apply to your existing repository
1. Ensure your previous changes were committed (faeac43 or newer).
2. Extract the ZIP **into the root** of `ARM64-Assembly`, preserving folder paths and allowing overwrite.
3. Keep `public/legacy/toolkit.html` and your existing `package.json`, Vite config, and `src/main.tsx`.
4. In VS Code's terminal run `npm run build`, then `npm run dev` if not already running.
5. Open http://localhost:5173 and choose Explain / Native React. Choose Complete Legacy Toolkit to access all existing tools.

## Included
- Original-inspired dark slate / amber / teal styling, sidebar and responsive layout.
- Native React multi-instruction selective Explain workflow.
- Mnemonic encyclopedia for common ARM64 instructions and mnemonic family fallbacks.
- Click-to-inspect mnemonics, operands, and nested memory parts (base, offset, pre-index marker).
- Effects/limitations and evidence-safe worked explanations.
- Original HTML retained and accessible under Complete Legacy Toolkit.

## Deliberate limitations
- Native Explain currently accepts assembly text only, not raw opcode bytes. The original disassembler remains in the Legacy Toolkit.
- No assembly execution or real memory reads are implied by descriptions.
- This is a first native Explain milestone, NOT a complete port of the legacy toolkit.
- Existing `src/analysis/mnemonics.ts`, `src/analysis/operands.ts`, `src/pages/Explain.tsx` are superseded only where the overlay explicitly includes a replacement.

## Quick checks
- `LDR W8, [X19, #0x200]` => destination W8; memory base X19; offset 512 decimal; 4 byte read.
- `CMP W8, #0` => flags, not saved subtraction result.
- `STP X29, X30, [SP, #-16]!` => two source registers; pre-index writeback.
- `B.EQ target` => conditional branch, flag state unknown.
- Switch to Legacy Toolkit => existing tools still available.
