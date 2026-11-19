import { useState } from 'react';
import Explain from './pages/Explain';
import './App.css';

type Page = 'explain' | 'legacy';

export default function App() {
  const [page, setPage] = useState<Page>('explain');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('arm64-native-sidebar-collapsed') === 'true'; }
    catch { return false; }
  });

  function toggleSidebar() {
    setSidebarCollapsed(previous => {
      const next = !previous;
      try { localStorage.setItem('arm64-native-sidebar-collapsed', String(next)); }
      catch { /* Storage can be disabled; the sidebar still works. */ }
      return next;
    });
  }

  const openPage = (next: Page) => {
    setPage(next);
    setMobileOpen(false);
  };

  return (
    <div className={`app-shell${sidebarCollapsed && page === 'explain' ? ' native-sidebar-collapsed' : ''}${page === 'legacy' ? ' legacy-page' : ''}`}>
      <div className="mobile-toolbar">
        {page === 'explain' ? (
          <button aria-label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(v => !v)}>☰</button>
        ) : (
          <button onClick={() => openPage('explain')} aria-label="Return to native Explain">←</button>
        )}
        <img className="toolkit-icon" src="/arm64-terminal.svg" alt="" />
        <strong>ARM64 RE TOOLKIT</strong>
      </div>

      {page === 'explain' && (
        <aside className={`sidebar${mobileOpen ? ' open' : ''}`} aria-label="Primary navigation">
          <div className="brand">
            <div className="brand-title-row">
              <img className="toolkit-icon" src="/arm64-terminal.svg" alt="" />
              <div className="brand-text">
                <div className="brand-name">RE TOOLKIT</div>
                <p>ARM64 + UnityFramework workbench</p>
              </div>
              <button className="native-collapse-button" type="button" onClick={toggleSidebar} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!sidebarCollapsed}>
                {sidebarCollapsed ? '»' : '«'}
              </button>
            </div>
            <div className="mode-note">REACT ANALYSIS · V4</div>
          </div>
          <div className="nav-group">WORKSPACE</div>
          <button title="Explain / Native React" className={`nav-entry${page === 'explain' ? ' selected' : ''}`} onClick={() => openPage('explain')}><span aria-hidden="true">›_</span><span className="nav-text">Explain / Native React</span></button>
          <div className="nav-group">TOOLS</div>
          <button title="Complete Legacy Toolkit" className="nav-entry" onClick={() => openPage('legacy')}><span aria-hidden="true">◇</span><span className="nav-text">Complete Legacy Toolkit</span></button>
          <div className="sidebar-bottom">Offline-first · No external analysis requests<br />Other tools remain available in Legacy.</div>
        </aside>
      )}

      <main className={`main-content${page === 'legacy' ? ' legacy-main' : ''}`}>
        {page === 'explain' ? (
          <>
            <div className="project-strip"><span>PROJECT <strong>ARM64-Assembly</strong></span><span>TARGET <strong>Offline analysis</strong></span><span className="strip-spacer" /><span>ARM64</span></div>
            <Explain />
          </>
        ) : (
          <div className="legacy-container">
            <div className="legacy-message">Complete original toolkit <span aria-hidden="true">·</span> <button onClick={() => openPage('explain')}>← Return to native Explain</button></div>
            <iframe title="Complete original ARM64 toolkit" src="/legacy/toolkit.html" />
          </div>
        )}
      </main>
    </div>
  );
}
