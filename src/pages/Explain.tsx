import { useMemo, useState } from 'react';
import { inspectToken, memoryParts, mnemonicInfo, parseInstructions, roleOfOperand, workedExample, type OperandPart, type ParsedInstruction } from '../analysis/explainEngine';
import { analyzeValueFlow, type FlowEntry } from '../analysis/valueFlow';

type Topic = 'mnemonic'|'operands'|'effects'|'example';
const topicList: {id:Topic;label:string}[] = [
  {id:'mnemonic',label:'Mnemonic meaning'},
  {id:'operands',label:'Operands and roles'},
  {id:'effects',label:'CPU effects and limitations'},
  {id:'example',label:'Execution walkthrough'},
];
const sample='LDR W8, [X19, #0x200]\nCMP W8, #0\nB.EQ target\nMOV W0, #1\nRET';
const arithmetic='MOV W0, #4\nADD W1, W0, #8\nCMP W1, #12\nB.EQ done';

function registerMentions(value:string){return [...new Set(value.toUpperCase().match(/\b(?:[WX](?:[0-9]|[12][0-9]|30)|SP|WSP|FP|LR)\b/g) ?? [])];}
function Inspector({item,onClose}:{item:OperandPart|null;onClose:()=>void}){
  return <aside className="inspector-card" aria-live="polite">
    <div className="card-heading"><h2>Inspector</h2><span className="small-label">SELECT A PART</span></div>
    {item ? <><div className="inspect-header"><span className="inspect-kind">{item.kind}</span><button className="quiet" onClick={onClose}>Clear ×</button></div><h3 className="inspect-token">{item.text}</h3><p className="inspect-description">{item.detail}</p>
    <div className="inspector-help"><strong>What we know</strong><p>These are architectural or syntactic properties derived from the assembly text.</p><strong>What we don't know</strong><p>Actual register contents, pointer validity and memory values require a runtime snapshot.</p></div></> : <><p className="inspect-placeholder">Click a highlighted mnemonic, register, constant, address expression, or modifier to see an expanded explanation here.</p><div className="inspector-help"><strong>Reading the code</strong><p><code>LDR W8, [X19, #0x200]</code></p><p><strong>LDR</strong> is the command, <strong>W8</strong> receives data, and the brackets describe where memory is read.</p></div></>}
  </aside>;
}
function InstructionCard({inst,topics,onInspect,flow}:{inst:ParsedInstruction;topics:Topic[];onInspect:(item:OperandPart)=>void;flow?:FlowEntry[]}){
  const mnemonic=mnemonicInfo(inst.mnemonic);
  const available=flow?.filter(entry=>entry.line===inst.id) ?? [];
  return <article className="instruction-result">
    <div className="instruction-top"><span className="instruction-code">{inst.raw}</span><span className="small-label">LINE {inst.id+1}</span></div>
    {inst.error&&<div className="notice error">{inst.error}</div>}
    {!inst.error&&<>
      {topics.includes('mnemonic')&&<section className="topic"><h3>Mnemonic <span className="precision">INSTRUCTION COMMAND</span></h3>
        <button className="mnemonic-button" onClick={()=>onInspect({text:inst.mnemonic,kind:'Mnemonic',detail:mnemonic?`${mnemonic.title}. ${mnemonic.plain} ${mnemonic.technical}`:'No verified definition exists in the current dictionary.'})}>{inst.mnemonic}<span>Inspect ↗</span></button>
        {mnemonic?<><p className="strong-line">{mnemonic.title}</p><p>{mnemonic.plain}</p><p className="muted-line"><strong>Technical meaning:</strong> {mnemonic.technical}</p></>:<p className="notice">This command is not in the teaching dictionary. Its behavior is not guessed.</p>}
      </section>}
      {topics.includes('operands')&&<section className="topic"><h3>Operands <span className="precision">CLICK EACH PART</span></h3>
        {inst.operands.length===0?<p>No written operands. Some instructions, such as RET, can use an implicit register.</p>:
          <div className="operand-rows">{inst.operands.map((operand,index)=>{
            const role=roleOfOperand(inst,index);
            const parts=operand.trim().startsWith('[')?memoryParts(operand):[inspectToken(operand,role)];
            // Post-index offset is a separate operand, not included in the brackets.
            return <div className="operand-row" key={`${inst.id}-${index}`}><span className="operand-number">{index+1}</span><div className="operand-main"><div className="operand-role">{role}</div><div className="chip-row">{parts.map((part,i)=><button key={i} className={`operand-chip ${i===0?'primary-chip':''}`} onClick={()=>onInspect(part)}>{part.text}</button>)}</div></div></div>;
          })}</div>}
        <p className="footnote">The roles explain assembly syntax, not values read from a live process.</p>
      </section>}
      {topics.includes('effects')&&<section className="topic"><h3>Effects <span className="precision">VERIFIED VS UNKNOWN</span></h3><p>{mnemonic?.effect || 'This instruction form has not been fully modeled.'}</p>
        <div className="effects-registers"><span>Registers mentioned:</span>{registerMentions(inst.raw).length?registerMentions(inst.raw).map(reg=><button key={reg} className="operand-chip" onClick={()=>onInspect(inspectToken(reg,'Register referenced in this instruction'))}>{reg}</button>):<span className="small-label">None explicitly</span>}</div>
      </section>}
      {topics.includes('example')&&<section className="topic"><h3>Execution walkthrough</h3><pre className="steps">{workedExample(inst)}</pre></section>}
      {available.map((entry,i)=><div className={`flow-inline ${entry.status}`} key={i}><strong>{entry.heading}</strong><p>{entry.description}</p>{entry.register&&<div className="flow-transition"><code>{entry.register}</code><span>{entry.before}</span><span>→</span><span>{entry.after}</span></div>}</div>)}
    </>}
  </article>;
}
export default function Explain(){
  const [input,setInput]=useState(sample);
  const [analyzed,setAnalyzed]=useState<ParsedInstruction[]>([]);
  const [selected,setSelected]=useState<number[]>([]);
  const [topics,setTopics]=useState<Topic[]>(['mnemonic','operands','effects','example']);
  const [shown,setShown]=useState(false);
  const [inspected,setInspected]=useState<OperandPart|null>(null);
  const [error,setError]=useState('');
  const picked=useMemo(()=>analyzed.filter(x=>selected.includes(x.id)),[analyzed,selected]);
  const valueFlow=useMemo(()=>analyzeValueFlow(analyzed),[analyzed]);
  function parse(show=false){const lines=parseInstructions(input);if(!lines.length){setError('Enter one or more ARM64 assembly instructions.');return;}if(lines.length>100){setError('Use no more than 100 instructions per analysis.');return;}setError('');setAnalyzed(lines);setSelected(lines.map(x=>x.id));setShown(show);setInspected(null);}
  function reset(text:string){setInput(text);setAnalyzed([]);setSelected([]);setShown(false);setError('');setInspected(null);}
  function toggle(id:number){setSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);setShown(false);}
  return <div className="explain-page">
    <header className="panel-head"><div className="heading-kicker">ANALYSIS / ARM64</div><h1>Selective ARM64 Explainer <span className="phase-tag">V3</span></h1><p>Understand the command, each operand, and how values relate. Click any highlighted part for a deeper explanation. Unknown runtime facts are never invented.</p></header>
    <div className="workspace-grid"><div className="workspace-primary">
      <section className="tool-card"><div className="card-heading"><h2>Instruction input</h2><span className="small-label">ARM64 ASM · OFFLINE</span></div>
        <label htmlFor="explain-input">Paste ARM64 assembly · one instruction per line</label><textarea id="explain-input" value={input} onChange={e=>setInput(e.target.value)} rows={6} spellCheck={false}/>
        <div className="action-row"><button className="action primary" onClick={()=>parse(true)}>Analyze now</button><button className="action" onClick={()=>parse(false)}>Parse and select</button><button className="action" onClick={()=>reset(sample)}>Load memory example</button><button className="action" onClick={()=>reset(arithmetic)}>Load arithmetic example</button><button className="action quiet" onClick={()=>reset('')}>Clear</button></div>
        <p className="footnote">Input is ARM64 assembly text. For raw hexadecimal bytes, use the Legacy Toolkit disassembler.</p>{error&&<div className="notice error">{error}</div>}
      </section>
      {analyzed.length>0&&<><section className="tool-card compact-card"><div className="card-heading"><h2>Select instruction(s)</h2><span className="small-label">{selected.length} / {analyzed.length}</span></div>
        <div className="action-row"><button className="action small" onClick={()=>{setSelected(analyzed.map(x=>x.id));setShown(false);}}>Select all</button><button className="action small" onClick={()=>{setSelected([]);setShown(false);}}>Clear</button><button className="action small" onClick={()=>{setSelected(analyzed.filter(x=>!selected.includes(x.id)).map(x=>x.id));setShown(false);}}>Invert</button></div>
        <div className="select-list">{analyzed.map(inst=><label key={inst.id} className="select-line"><input type="checkbox" checked={selected.includes(inst.id)} onChange={()=>toggle(inst.id)}/><span className="line-number">{inst.id+1}</span><code>{inst.raw}</code>{inst.error&&<span className="error-text">PARSE ISSUE</span>}</label>)}</div>
      </section><section className="tool-card compact-card"><div className="card-heading"><h2>Explanation depth</h2><span className="small-label">OPTIONAL TOPICS</span></div><div className="topic-choices">{topicList.map(topic=><label key={topic.id} className="topic-choice"><input type="checkbox" checked={topics.includes(topic.id)} onChange={()=>{setTopics(prev=>prev.includes(topic.id)?prev.filter(x=>x!==topic.id):[...prev,topic.id]);setShown(false);}}/><span>{topic.label}</span></label>)}</div><div className="action-row"><button className="action primary" disabled={!selected.length||!topics.length} onClick={()=>setShown(true)}>Explain selected</button></div></section></>}
      {shown&&<section className="results" aria-live="polite"><div className="results-heading"><h2>Instruction explanations</h2><span className="small-label">{picked.length} SELECTED</span></div>{picked.map(inst=><InstructionCard key={inst.id} inst={inst} topics={topics} onInspect={setInspected} flow={valueFlow.entries}/>)}</section>}
    </div><div className="workspace-aside"><Inspector item={inspected} onClose={()=>setInspected(null)}/>
      <section className="inspector-card"><div className="card-heading"><h2>Value flow</h2><span className="small-label">LIMITED · STATIC</span></div>
        {analyzed.length===0?<p className="inspect-placeholder">Analyze instructions to see register dependencies and what can be established from the supplied sequence.</p>:<>
          <p className="footnote">Tracks simple MOV, ADD, SUB, LDR and CMP patterns until a branch, return, call, or unsupported operation. This is not a CPU emulator.</p>
          <div className="flow-list">{valueFlow.entries.map((entry,i)=><div className={`flow-item ${entry.status}`} key={i}><span className="small-label">LINE {entry.line+1} · {entry.status.toUpperCase()}</span><strong>{entry.heading}</strong><p>{entry.description}</p></div>)}</div>
          {valueFlow.registers.length>0&&<><h3 className="aside-subtitle">Known / symbolic register state</h3><div className="state-list">{valueFlow.registers.map(r=><div className="state-row" key={r.name}><code>{r.name}</code><span>{r.value}</span><small>{r.from}</small></div>)}</div></>}
          {valueFlow.stoppedAt!==null&&<div className="notice">Analysis stops at line {valueFlow.stoppedAt+1} to avoid treating another control-flow path as definitely executed.</div>}
        </>}
      </section>
    </div></div>
  </div>;
}
