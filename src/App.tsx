/**
 * Temporary compatibility bridge: retain the complete, working toolkit while
 * migrating each analysis and UI section to React + TypeScript incrementally.
 * The legacy page is same-origin, served from Vite's public directory.
 */
export default function App() {
  return (
    <iframe
      className="toolkit-frame"
      title="ARM64 Reverse Engineering Toolkit"
      src="/legacy/toolkit.html"
    />
  );
}
