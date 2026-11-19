import { useState } from 'react';
import Explain from './pages/Explain';
import './App.css';

type Page = 'explain'|'legacy';
export default function App(){
  const [page,setPage] = useState<Page>('explain');
  const [mobileOpen,setMobileOpen] = useState(false);
  return <div className="app-shell">
    <div className="mobile-toolbar"><button aria-label="Open navigation" onClick={()=>setMobileOpen(v=>!v)}>☰</button><strong>ARM64 RE TOOLKIT</strong></div>
    <aside className={`sidebar ${mobileOpen?'open':''}`}>
      <div className="brand"><div className="brand-name">RE TOOLKIT</div><p>ARM64 + UnityFramework workbench</p><div className="mode-note">REACT ANALYSIS · V2</div></div>
      <div className="nav-group">WORKSPACE</div><button className={`nav-entry ${page==='explain'?'selected':''}`} onClick={()=>{setPage('explain');setMobileOpen(false);}}><span>›_</span> Explain / Native React</button>
      <div className="nav-group">TOOLS</div><button className={`nav-entry ${page==='legacy'?'selected':''}`} onClick={()=>{setPage('legacy');setMobileOpen(false);}}><span>◇</span> Complete Legacy Toolkit</button>
      <div className="sidebar-bottom">Offline-first · No external analysis requests<br/>Other tools remain available in Legacy.</div>
    </aside>
    <main className={`main-content ${page==='legacy'?'legacy-main':''}`}>
      {page==='explain'?<><div className="project-strip"><span>PROJECT <strong>ARM64-Assembly</strong></span><span>TARGET <strong>Offline analysis</strong></span><span className="strip-spacer"/><span>ARM64</span></div><Explain/></>:<div className="legacy-container"><div className="legacy-message">Complete original toolkit · <button onClick={()=>setPage('explain')}>Return to native Explain</button></div><iframe title="Complete original ARM64 toolkit" src="/legacy/toolkit.html"/></div>}
    </main>
  </div>;
}
