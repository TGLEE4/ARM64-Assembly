import { parseImmediate, registerWidth, unsignedAtWidth } from './numeric';
import type { ParsedInstruction } from './explainEngine';

export type FlowEntry = { line:number; instruction:string; heading:string; description:string; before?:string; after?:string; status:'known'|'symbolic'|'boundary'; register?:string };
export type FlowResult = { entries:FlowEntry[]; registers:{name:string;value:string;from:string}[]; stoppedAt:number|null };

type Value={expression:string;source:string; known:bigint|null};
const register=/^(?:[XW](?:[0-9]|[12][0-9]|30)|SP|WSP|FP|LR|XZR|WZR)$/i;
const normal=(r:string)=> {const u=r.toUpperCase();return u==='FP'?'X29':u==='LR'?'X30':u;};
const canonical=(r:string)=>normal(r).replace(/^W(?=\d+$)/,'X').replace(/^WSP$/,'SP');
const immediate = parseImmediate;
const valueText=(v:bigint)=>`${v.toString(10)} (0x${v.toString(16).toUpperCase()})`;
export function analyzeValueFlow(instructions:ParsedInstruction[]):FlowResult{
  const state=new Map<string,Value>(); const entries:FlowEntry[]=[]; let stoppedAt:number|null=null;
  const read=(operand:string):Value=>{
    const name=normal(operand.trim()); if(name==='XZR'||name==='WZR')return {expression:'0',source:'Architectural zero register',known:0n};
    const n=immediate(operand);if(n!==null)return {expression:valueText(n),source:'Immediate constant',known:n};
    if(register.test(name)){const stored=state.get(canonical(name));if(stored){if(name.startsWith('W')&&stored.known!==null)return {...stored,known:stored.known&0xffffffffn,expression:valueText(stored.known&0xffffffffn)};return stored;}return {expression:`${name} (unknown)`,source:'Not established by supplied instructions',known:null};}
    return {expression:operand,source:'Not a modeled value',known:null};
  };
  const write=(destination:string,value:Value,line:number)=>{
    const dest=normal(destination);if(!register.test(dest)||dest==='XZR'||dest==='WZR')return;
    const key=canonical(dest);const known=value.known===null?null:unsignedAtWidth(value.known, registerWidth(dest));
    state.set(key,{known,expression:known!==null?valueText(known):value.expression,source:`Line ${line + 1}: ${value.source}`});
  };
  for(const inst of instructions){
    const op=inst.mnemonic, a=inst.operands, line=inst.id;
    if(inst.error){entries.push({line,instruction:inst.raw,heading:'Parsing issue',description:inst.error,status:'boundary'});continue;}
    const event=(heading:string,description:string,status:FlowEntry['status']='symbolic',registerName?:string,before?:string,after?:string)=>entries.push({line,instruction:inst.raw,heading,description,status,register:registerName,before,after});
    // Pre/post-index memory instructions also modify the base register.
    // Until writeback is modeled, stop rather than reuse a stale base value.
    if (/^(?:LDR|LDUR|STR|STUR|LDP|STP)/.test(op) &&
        (a.some(x => /\]!\s*$/.test(x)) || a.length > (op === 'LDP' || op === 'STP' ? 3 : 2))) {
      event('Memory writeback boundary','This addressing form changes the base register; value flow stops before assuming its new address.', 'boundary');
      stoppedAt=line;break;
    }
    if(op==='MOV'&&a.length===2&&register.test(a[0])){
      const old=read(a[0]); const src=read(a[1]);write(a[0],{...src,source:`${op} copies ${a[1]}`},line);
      event('Value assigned',`${a[0]} receives ${src.expression}. ${src.known===null?'The original source value is not known.':'The source is a known constant.'}`,src.known===null?'symbolic':'known',a[0],old.expression,read(a[0]).expression);
    }else if(op==='MOVZ'&&a.length>=2&&a.length<=3&&register.test(a[0])){
      const raw=immediate(a[1]);
      const sh=a.length===3?a[2].match(/^LSL\s+#(0|16|32|48)$/i):null;
      const shift=a.length===2?0:sh?Number(sh[1]):null;
      const width=registerWidth(a[0]);
      if(raw===null||raw<0n||raw>0xffffn||shift===null||shift>=width){event('Unmodeled MOVZ form','Invalid or unsupported MOVZ immediate/shift; no value inferred.','boundary');stoppedAt=line;break;}
      const old=read(a[0]);const result=raw<<BigInt(shift);
      write(a[0],{known:result,expression:valueText(result),source:'MOVZ 16-bit immediate with zero fill'},line);
      event('Wide immediate constructed',`${a[0]} gets ${valueText(result)}. All other bits are zero.`, 'known',a[0],old.expression,read(a[0]).expression);
    }else if(op==='MOVK'&&a.length>=2&&a.length<=3&&register.test(a[0])){
      const raw=immediate(a[1]);
      const sh=a.length===3?a[2].match(/^LSL\s+#(0|16|32|48)$/i):null;
      const shift=a.length===2?0:sh?Number(sh[1]):null;
      const width=registerWidth(a[0]);
      if(raw===null||raw<0n||raw>0xffffn||shift===null||shift>=width){event('Unmodeled MOVK form','Invalid or unsupported MOVK immediate/shift; no value inferred.','boundary');stoppedAt=line;break;}
      const old=read(a[0]);const clear=~(0xffffn<<BigInt(shift));
      const result=old.known===null?null:(old.known&clear)|(raw<<BigInt(shift));
      write(a[0],{known:result,expression:result===null?`replace bits ${shift}–${shift+15} of ${old.expression} with ${raw}`:valueText(result),source:'MOVK preserves other halfwords'},line);
      event('Wide halfword replaced',`${a[0]} changes only bits ${shift}–${shift+15}. ${result===null?'Other bits are unknown.':'The previous value was known, so the result is exact.'}`,result===null?'symbolic':'known',a[0],old.expression,read(a[0]).expression);
    }else if(['ADD','SUB'].includes(op)&&a.length===3&&register.test(a[0])){
      const old=read(a[0]),left=read(a[1]),right=read(a[2]);const calc=left.known!==null&&right.known!==null?(op==='ADD'?left.known+right.known:left.known-right.known):null;
      const formula=`${left.expression} ${op==='ADD'?'+':'−'} ${right.expression}`;
      write(a[0],{known:calc,expression:formula,source:`${op} of ${a[1]} and ${a[2]}`},line);
      event('Arithmetic dependency',`${a[0]} depends on ${a[1]} and ${a[2]}. ${calc===null?'At least one input is unknown; the formula is symbolic.':'Both inputs are known, so the result is calculated.'}`,calc===null?'symbolic':'known',a[0],old.expression,read(a[0]).expression);
    }else if(['AND','ORR','EOR','LSL','LSR','ASR','MUL'].includes(op)&&a.length===3&&register.test(a[0])){
      const old=read(a[0]),left=read(a[1]),right=read(a[2]);
      const width=registerWidth(a[0]);let calculated:bigint|null=null;
      if(left.known!==null&&right.known!==null){
        const x=unsignedAtWidth(left.known,width),y=right.known;
        if(op==='AND')calculated=x&y;
        if(op==='ORR')calculated=x|y;
        if(op==='EOR')calculated=x^y;
        if(op==='MUL')calculated=x*y;
        if(['LSL','LSR','ASR'].includes(op)&&y>=0n&&y<BigInt(width)){
          if(op==='LSL')calculated=x<<y;
          if(op==='LSR')calculated=x>>y;
          if(op==='ASR')calculated=BigInt.asIntN(width,x)>>y;
        }
      }
      const expr=`${op}(${left.expression}, ${right.expression})`;
      write(a[0],{known:calculated,expression:expr,source:`${op} of ${a[1]} and ${a[2]}`},line);
      event('Bitwise / shift dependency',`${a[0]} = ${expr}. ${calculated===null?'One or more inputs cannot be evaluated.':'Both inputs were known.'}`,calculated===null?'symbolic':'known',a[0],old.expression,read(a[0]).expression);
    }else if((op==='LDR'||op==='LDUR')&&a.length>=2&&register.test(a[0])){
      const old=read(a[0]);const expression=`Memory${a[1]}`;write(a[0],{known:null,expression,source:'Memory read (no snapshot supplied)'},line);
      event('Memory read',`${a[0]} receives data read from ${a[1]}. The source address expression is visible, but its memory contents are not provided.`, 'symbolic',a[0],old.expression,expression);
    }else if(op==='CMP'&&a.length>=2){
      event('Comparison dependency',`NZCV flags depend on ${a[0]} (${read(a[0]).expression}) compared against ${a[1]} (${read(a[1]).expression}). This view does not infer branch results.`);
    }else if(/^B\.|^(?:B|BR|BL|BLR|RET|CBZ|CBNZ|TBZ|TBNZ)$/.test(op)){
      stoppedAt=line;event('Control-flow boundary',`Execution can ${op==='RET'?'return':op==='BL'||op==='BLR'?'call another function':'change path'} here. Subsequent lines are not treated as a proven sequential execution path.`, 'boundary');break;
    }else if(/^(?:STR|STUR|STP)$/.test(op)){
      event('Memory write',`This instruction writes memory. The analyzer does not know the destination memory contents before or after execution.`);
    }else{
      event('Not symbolically modeled',`The mnemonic ${op} is not handled by this limited value-flow engine. No register outcome is assumed.`, 'boundary');stoppedAt=line;break;
    }
  }
  const registers=[...state.entries()].map(([name,value])=>({name,value:value.expression,from:value.source}));
  return {entries,registers,stoppedAt};
}
