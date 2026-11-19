# ARM64 Phase 3 — Explain + Inspector + Value Flow

Apply this ZIP at the **root of your existing** `ARM64-Assembly` Vite repository. It intentionally contains only changed `src/` files and this README. Do **not** delete `public/legacy/toolkit.html` or overwrite package.json.

1. Make sure earlier changes are committed to GitHub.
2. Extract and copy the package contents into the repository root, replacing the named files.
3. Run `npm run build`, then `npm run dev`.
4. Open the Vite URL displayed in your terminal.
5. Test both provided examples, click `LDR`, `W8`, `X19`, and `#0x200`, and open Legacy Toolkit to verify it still loads.

## What is new

- The original dark sidebar/palette remains.
- Full-width responsive workspace with a sticky right-hand operand inspector.
- Single-click `Analyze now` alongside the existing selective flow.
- Mnemonic/operand inspection and embedded execution examples.
- Conservative, limited value tracking for MOV, MOVZ, ADD, SUB, LDR, LDUR, and CMP with known versus symbolic values. **Flow stops** at a call/branch/return or unsupported instruction to avoid false straight-line claims. It is **not** a CPU emulator or runtime debugger.

## Important limits

- Assembly input only (hex decoding remains in Legacy Toolkit).
- Linear value-flow is a teaching aid, not verified execution; branches and unsupported instructions stop the trace.
- No runtime memory readings, live register values, or control-flow graph.
- Conditional branches are not resolved; missing information is labeled unknown.
- Example `LDR` memory contents remain unknown unless supplied through future functionality.

After testing, commit with `git add . && git commit -m "Phase 3 advanced Explain and value-flow inspector" && git push origin main`.
