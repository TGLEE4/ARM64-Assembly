import { useMemo, useState } from 'react';
import { inspectToken, memoryParts, mnemonicInfo, parseInstructions, roleOfOperand, workedExample, type OperandPart, type ParsedInstruction } from '../analysis/explainEngine';

type Topic = 'mnemonic'|'operands'|'effects'|'example';
const topicList: {id:Topic;label:string}[] = [
  {id:'mnemonic',label:'Mnemonic — what the command means'},
  {id:'operands',label:'Operands — each part and its job'},
  {id:'effects',label:'What changes / what stays unknown'},
  {id:'example',label:'Step-by-step worked example'},
];
const sample = 'LDR W8, [X19, #0x200]\nCMP W8, #0\nB.EQ target\nMOV W0, #1\nRET';

function Detail({item,close}:{item:OperandPart;close:()=>void}) {
  return <div className="detail-panel" role="region" aria-label="Selected operand details">
    <div className="detail-top"><span className="eyebrow">SELECTED PART · {item.kind}</span><button type="button" className="quiet" onClick={close}>Close ×</button></div>
    <h4>{item.text}</h4><p>{item.detail}</p>
  </div>;
}

function InstructionCard({inst,topics}:{inst:ParsedInstruction;topics:Topic[]}) {
  const [chosen,setChosen] = useState<OperandPart|null>(null);
  const mnemonic = mnemonicInfo(inst.mnemonic);
  return <article className="instruction-result">
    <div className="instruction-top"><span className="instruction-code">{inst.raw}</span><span className="small-label">LINE {inst.id + 1}</span></div>
    {inst.error && <div className="notice error">{inst.error}</div>}
    {!inst.error && <>
      {topics.includes('mnemonic') && <section className="topic">
        <h3>Mnemonic <span className="precision">ARCHITECTURAL MEANING</span></h3>
        <button className="mnemonic-button" type="button" onClick={()=>setChosen({text:inst.mnemonic,kind:'Mnemonic',detail:mnemonic ? `${mnemonic.title}. ${mnemonic.plain} ${mnemonic.technical}` : 'No verified teaching definition is available for this mnemonic yet.'})}>{inst.mnemonic} <span>Explore ↗</span></button>
        {mnemonic ? <><p className="strong-line">{mnemonic.title}</p><p>{mnemonic.plain}</p><p className="muted-line"><strong>Technical explanation:</strong> {mnemonic.technical}</p><p className="muted-line"><strong>Example:</strong> {mnemonic.example}</p></> : <div className="notice">This mnemonic is not yet documented in the native teaching dictionary. No behavior has been guessed.</div>}
      </section>}
      {topics.includes('operands') && <section className="topic">
        <h3>Operands <span className="precision">CLICK ANY PART</span></h3>
        {inst.operands.length === 0 ? <p>No explicit operands. Some instructions (like RET) have an implied register.</p> : <div className="operand-rows">{inst.operands.map((operand,index) => {
          const role = roleOfOperand(inst,index);
          const parts = operand.trim().startsWith('[') ? memoryParts(operand) : [inspectToken(operand,role)];
          return <div className="operand-row" key={`${inst.id}-${index}`}>
            <span className="operand-number">{index+1}</span><div className="operand-main"><div className="operand-role">{role}</div><div className="chip-row">{parts.map((part,i)=><button key={i} type="button" className={`operand-chip ${i===0?'primary-chip':''}`} onClick={()=>setChosen(part)}>{part.text}</button>)}</div></div>
          </div>;
        })}</div>}
        <p className="footnote">These describe operand roles, not live register contents. Unsupported expressions are labeled instead of interpreted as facts.</p>
      </section>}
      {topics.includes('effects') && <section className="topic"><h3>Effects and limitations</h3><p>{mnemonic?.effect || 'Register, memory and flag effects have not yet been verified for this mnemonic.'}</p><p className="footnote">The page does not connect to a running process. Actual register values, memory contents, and branch outcomes require additional evidence.</p></section>}
      {topics.includes('example') && <section className="topic"><h3>Worked example</h3><pre className="steps">{workedExample(inst)}</pre></section>}
      {chosen && <Detail item={chosen} close={()=>setChosen(null)}/>}
    </>}
  </article>;
}

export default function Explain(){
  const [input,setInput]=useState(sample);
  const [analyzed,setAnalyzed]=useState<ParsedInstruction[]>([]);
  const [selected,setSelected]=useState<number[]>([]);
  const [topics,setTopics]=useState<Topic[]>(['mnemonic','operands','effects','example']);
  const [shown,setShown]=useState(false);
  const [error,setError]=useState('');
  const picked=useMemo(()=>analyzed.filter(x=>selected.includes(x.id)),[analyzed,selected]);
  function parse(){const lines=parseInstructions(input);if(!lines.length){setError('Enter one or more ARM64 assembly instructions.');return;} if(lines.length>100){setError('For responsive analysis, paste at most 100 instructions at a time.');return;}setError('');setAnalyzed(lines);setSelected(lines.map(x=>x.id));setShown(false);}
  function toggle(id:number){setSelected(previous=>previous.includes(id)?previous.filter(x=>x!==id):[...previous,id]);setShown(false);}
  function topicToggle(id:Topic){setTopics(previous=>previous.includes(id)?previous.filter(x=>x!==id):[...previous,id]);setShown(false);}
  return <div className="explain-page">
    <header className="panel-head"><div className="heading-kicker">ANALYSIS / ARM64</div><h1>Selective ARM64 Explainer</h1><p>Understand what each mnemonic and operand means, how an instruction works, and what is still unknown. Detailed analysis runs only when requested.</p></header>
    <section className="tool-card"><div className="card-heading"><h2>Instruction input</h2><span className="small-label">ARM64 ASM · MANUAL ANALYSIS</span></div>
      <label htmlFor="explain-input">Paste ARM64 assembly · one instruction per line</label>
      <textarea id="explain-input" value={input} onChange={e=>setInput(e.target.value)} spellCheck={false} rows={7} placeholder="LDR W8, [X19, #0x200]"/>
      <div className="action-row"><button type="button" className="action primary" onClick={parse}>1 · Parse instructions</button><button type="button" className="action" onClick={()=>{setInput(sample);setAnalyzed([]);setShown(false);setError('');}}>Load example</button><button type="button" className="action quiet" onClick={()=>{setInput('');setAnalyzed([]);setShown(false);setError('');}}>Clear</button></div>
      <p className="footnote">This first native React version accepts ARM64 assembly text. For raw hexadecimal decoding, open the Legacy Toolkit's Disassembler.</p>{error&&<div className="notice error">{error}</div>}
    </section>
    {analyzed.length>0&&<><section className="tool-card"><div className="card-heading"><h2>Select instruction(s)</h2><span className="small-label">{selected.length} OF {analyzed.length} SELECTED</span></div><div className="action-row"><button className="action small" onClick={()=>{setSelected(analyzed.map(x=>x.id));setShown(false);}}>Select all</button><button className="action small" onClick={()=>{setSelected([]);setShown(false);}}>Clear</button><button className="action small" onClick={()=>{setSelected(analyzed.filter(x=>!selected.includes(x.id)).map(x=>x.id));setShown(false);}}>Invert</button></div><div className="select-list">{analyzed.map(inst=><label className="select-line" key={inst.id}><input type="checkbox" checked={selected.includes(inst.id)} onChange={()=>toggle(inst.id)}/><span className="line-number">{inst.id+1}</span><code>{inst.raw}</code>{inst.error&&<span className="error-text">PARSE ISSUE</span>}</label>)}</div></section>
      <section className="tool-card"><div className="card-heading"><h2>What do you want to understand?</h2><span className="small-label">SELECT TOPICS</span></div><div className="topic-choices">{topicList.map(topic=><label className="topic-choice" key={topic.id}><input type="checkbox" checked={topics.includes(topic.id)} onChange={()=>topicToggle(topic.id)}/><span>{topic.label}</span></label>)}</div><div className="action-row"><button className="action primary" disabled={!selected.length||!topics.length} onClick={()=>setShown(true)}>2 · Explain selected</button><button className="action" onClick={()=>{setTopics([]);setShown(false);}}>Clear topics</button></div></section>
    </>}
    {shown && <section className="results" aria-live="polite"><div className="results-heading"><h2>Explanation results</h2><span className="small-label">{picked.length} INSTRUCTIONS</span></div>{picked.map(inst=><InstructionCard key={`${inst.id}-${inst.raw}-${topics.join()}`} inst={inst} topics={topics}/>)}</section>}
  </div>;
}
