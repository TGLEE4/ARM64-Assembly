# ARM64 Toolkit — Terminal icon + sidebar polish

This is a small correction to the previous Sidebar & Icon Fix. It replaces the purple lightning favicon/logo with a boxed ARM64 terminal prompt icon using the existing theme colors (#F0A63C amber, #54D0BB teal, #121722 slate).

## Install

1. Confirm `git branch --show-current` is `develop`.
2. Copy `index.html`, `src/App.tsx`, `src/App.css`, and `public/arm64-terminal.svg` into the same paths in your repository, replacing matching files.
3. Run `npm run build`; then use `npm run dev` to check the desktop, collapsed, mobile, and Legacy views.
4. The old `public/disassembler-icon.png` file is no longer referenced; optionally delete it from your local repository if it exists. This update does not require deleting it.

## Details

- Fixes the CSS causing sidebar labels to wrap every few words.
- Preserves sidebar collapse and responsive content expansion.
- Removes the icon from the Legacy toolbar (the outer React sidebar is still hidden in Legacy mode).
- Replaces header icon and favicon with a theme-matched boxed terminal prompt.

The build and browser behavior should be tested before merging to `main`.
