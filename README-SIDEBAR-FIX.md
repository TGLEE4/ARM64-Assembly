# ARM64 sidebar and icon update

Apply this package to the existing `ARM64-Assembly` repository while on `develop`.

- Uses the supplied purple KAVEDROID-style icon as the favicon and brand icon.
- Native React sidebar collapses to an icon rail, expanding the Explain workspace.
- Legacy view no longer displays the extra outer React sidebar.
- Original legacy sidebar now collapses fully; the toolkit fills freed width.
- Desktop collapse state persists locally; mobile keeps its existing navigation drawer.

Test both modes, then run `npm run build`. Commit and push to `develop` only after testing.
