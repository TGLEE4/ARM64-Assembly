import { parseImmediate } from './numeric';
import type { ParsedInstruction } from './explainEngine';

export type Guide = { heading:string; steps:string[]; pseudocode:string; reads:string[]; writes:string[]; certainty:string; warning?:string };
const number = /^#([+-]?(?:0x[0-9a-f]+|\d+))$/i;
function decimal(source:string):string|null{
  const match=source.trim().match(number);if(!match)return null;
  const value = parseImmediate(match[1]); return value === null ? null : value.toString();
}
function memory(token:string):{base:string;offset:string;kind:'offset'|'pre'|'post'}|null{
  const match=token.trim().match(/^\[\s*([XW](?:[0-9]|[12][0-9]|30)|SP)\s*(?:,\s*(#[+-]?(?:0x[0-9a-f]+|\d+)))?\s*\](!)?$/i);
  if(!match)return null;
  return {base:match[1].toUpperCase(),offset:match[2]??'#0',kind:match[3]?'pre':'offset'};
}
function showImmediate(token:string):string{return decimal(token)===null?token:`${token} (${decimal(token)} decimal)`;}
const simple=(heading:string,steps:string[],pseudocode:string,reads:string[],writes:string[],certainty='Architectural behavior is known; runtime register values are not supplied.',warning?:string):Guide=>({heading,steps,pseudocode,reads,writes,certainty,warning});
export function guideInstruction(inst:ParsedInstruction):Guide{
  const op=inst.mnemonic.toUpperCase(), a=inst.operands;
  if(inst.error)return simple('Could not analyze instruction',[inst.error],'Not available',[],[], 'No instruction behavior inferred.');
  if(['LDR','STR','LDRB','STRB','LDRH','STRH','LDRSW'].includes(op)&&a.length>=2){
    const address=memory(a[1]);
    const isLoad=op.startsWith('LDR');
    const width=op.endsWith('B')?1:op.endsWith('H')?2:op==='LDRSW'?4:a[0]?.toUpperCase().startsWith('W')?4:8;
    if(address){
      const offset=a.length===3&&address.kind==='offset'?a[2]:address.offset;
      const post=a.length===3;
      const base=address.base;
      const steps=[`Read the current address held in ${base} (unknown unless you supply its value).`,
        post?`Use the original address in ${base} for the memory access.`:`Calculate an effective address: ${base} + ${showImmediate(offset)} bytes.`,
        isLoad?`Read ${width} byte${width===1?'':'s'} from the computed address; place the result into ${a[0]}.`:`Write ${width} byte${width===1?'':'s'} from ${a[0]} into memory at that address.`,
        post?`After the access, update ${base} by ${showImmediate(offset)} bytes.`:address.kind==='pre'?`Write the computed address back to ${base} because of the ! marker.`:'The base register does not change for this offset-addressing form.' ];
      const dest=isLoad?a[0]:`memory[${base}${post?'':` + ${offset}`} ]`;
      return simple(isLoad?'Memory load':'Memory store',steps,isLoad?`${dest} = load${width*8}(memory[${base}${post?'':` + ${offset}`}])`:`store${width*8}(memory[${base}${post?'':` + ${offset}`}], ${a[0]})`,isLoad?[base,'memory']:[a[0],base],isLoad?[a[0],...(address.kind==='pre'||post?[base]:[])]:['memory',...(address.kind==='pre'||post?[base]:[])], 'Transfer width and addressing semantics come from the instruction; actual pointer validity and memory contents are unknown.',op==='LDRSW'?'LDRSW sign-extends a 32-bit value into a 64-bit register.':undefined);
    }
    return simple('Memory addressing',[`This ${op} form uses an addressing mode not yet supported by the walkthrough.`, 'Inspect the operands separately; do not assume an effective address or a writeback amount.'],'Address requires additional decoding',[],[], 'Not evaluated.');
  }
  if((op==='MOV'||op==='MOVZ')&&a.length>=2){
    return simple('Copy / construct a value',[`Identify the destination ${a[0]}.`,`Read the source ${showImmediate(a[1])}.`,op==='MOVZ'?'Place the 16-bit immediate into the selected halfword and clear all other bits (if no shift, the low halfword).':`Write the source value to ${a[0]}; the source is not erased.`,/^W(?:\d+|ZR)$/i.test(a[0])?'Writing a W register zeroes the upper half of the corresponding X register.':'Other general-purpose registers are unchanged.'],`${a[0]} = ${a[1]}`,[a[1]],[a[0]],'A copied immediate is a known constant; a copied register requires an earlier value.');
  }
  if((op==='MOVZ'||op==='MOVK')&&a.length>=2){
    const shift=a[2]??'LSL #0';
    return simple(op==='MOVZ'?'Create a register constant':'Replace part of a register',
      [`Read the 16-bit immediate ${showImmediate(a[1])}.`,
       `Position that immediate according to ${shift}.`,
       op==='MOVZ'?'Clear all other destination bits to zero.':'Keep all destination bits outside the selected 16-bit section.',
       `Write the constructed value to ${a[0]}.`],
      op==='MOVZ'?`${a[0]} = unsigned16(${a[1]}) shifted by ${shift}`:`${a[0]} = replace_16_bits(${a[0]}, ${a[1]}, ${shift})`,
      op==='MOVZ'?[a[1]]:[a[0],a[1]],[a[0]],
      op==='MOVK'?'The untouched bits require the prior destination value; do not invent them.':'Exact value requires a valid immediate and shift.');
  }
  if(['AND','ORR','EOR','BIC','LSL','LSR','ASR','MUL'].includes(op)&&a.length>=3){
    const operations:Record<string,string>={AND:'bitwise AND',ORR:'bitwise OR',EOR:'bitwise XOR',BIC:'bitwise AND with an inverted second source',LSL:'shift bits left',LSR:'shift bits right with zero fill',ASR:'shift bits right retaining the sign',MUL:'multiply'};
    return simple('Bit manipulation / arithmetic',[
      `Read the first input ${a[1]}.`, `Read the second input or shift amount ${showImmediate(a[2])}.`,
      `Apply ${operations[op]} at the destination width.`, `Write the result to ${a[0]}; NZCV flags are not modified by this mnemonic.`],
      `${a[0]} = ${op}(${a[1]}, ${a[2]})`,[a[1],a[2]],[a[0]],
      'The operation is architecturally defined; the result needs known input values and a valid operand form.');
  }
  if(op==='CSEL'&&a.length>=4){
    return simple('Select based on condition',[
      `Read NZCV condition flags and test ${a[3]}.`,
      `If ${a[3]} is satisfied, select ${a[1]}; otherwise select ${a[2]}.`,
      `Write the chosen value to ${a[0]}; leave flags unchanged.`],
      `${a[0]} = condition(${a[3]}) ? ${a[1]} : ${a[2]}`,[a[1],a[2],'NZCV'],[a[0]],
      'Only the selected source is written; the condition outcome depends on earlier flag-setting instructions.');
  }
  if(['ADD','SUB','ADDS','SUBS'].includes(op)&&a.length>=3){
    const subtract=op.startsWith('SUB'),setsFlags=op.endsWith('S');
    return simple(subtract?'Subtraction':'Addition',[`Read source ${a[1]} and source ${showImmediate(a[2])}.`,`Compute ${a[1]} ${subtract?'−':'+'} ${a[2]} at the destination register width.`,`Write the result into ${a[0]}.`,setsFlags?'Update the N, Z, C, and V condition flags.':'Do not modify the NZCV condition flags.'],`${a[0]} = ${a[1]} ${subtract?'-':'+'} ${a[2]}`,[a[1],a[2]],[a[0],...(setsFlags?['NZCV']:[])],'The formula is certain; the numerical result is only known if both input values are known.');
  }
  if((op==='CMP'||op==='CMN')&&a.length>=2){
    return simple('Compare values',[`Read ${a[0]} and ${showImmediate(a[1])}.`,`Calculate ${a[0]} ${op==='CMP'?'−':'+'} ${a[1]} using the operand register width.`,`Update N (negative), Z (zero), C (carry/no-borrow), and V (signed overflow).`,'Discard the arithmetic result: neither source register is overwritten.'],`NZCV = flags(${a[0]} ${op==='CMP'?'-':'+'} ${a[1]})`,a.slice(0,2),['NZCV'],'A later conditional branch can use these flags; the result is unknown until values are supplied.');
  }
  if(/^B\./.test(op)&&a.length){const condition=op.slice(2);return simple('Conditional branch',[`Check the ${condition} condition using current NZCV flags.`,`If the condition is satisfied, branch to ${a[0]}.`,'Otherwise, proceed to the following instruction.','This instruction does not itself change the NZCV flags.'],`if (condition_${condition}(NZCV)) goto ${a[0]}`,['NZCV'],['PC'],'The flag source and outcome require preceding instructions; no branch path is assumed.');}
  if(['CBZ','CBNZ'].includes(op)&&a.length>=2)return simple('Register-conditional branch',[`Read ${a[0]}.`,`Test whether it is ${op==='CBZ'?'zero':'not zero'}.`,`If true, jump to ${a[1]}; otherwise continue.`,'NZCV flags remain unchanged.'],`if (${a[0]} ${op==='CBZ'?'==':'!='} 0) goto ${a[1]}`,[a[0]],['PC'],'Only one path is taken at runtime; register value is not supplied.');
  if(['B','BL','RET'].includes(op))return simple('Control-flow change',[op==='RET'?'Read the return address from X30 (or an explicitly specified register).':`Determine the branch destination ${a[0]??'(not specified)'}.`,op==='BL'?'Write the address of the following instruction to X30 (link register).':'Do not infer changes to unrelated registers.',op==='RET'?'Continue at the return address.':'Continue execution at the branch target.'],op==='RET'?'PC = X30':`PC = ${a[0]??'?'}${op==='BL'?' ; X30 = return_address':''}`,op==='RET'?['X30']:[],['PC',...(op==='BL'?['X30']:[])],'The destination may be symbolic; downstream code must be supplied for full function behavior.');
  if(op==='NOP')return simple('No operation',['The CPU performs this no-operation hint.','Move to the next instruction in program order.'],'/* no observable general-purpose register change */',[],[],'No register or memory result is produced by the architectural NOP instruction.');
  return simple('Unmodeled instruction form',[`The instruction ${op} does not have a verified execution walkthrough yet.`,'Use the mnemonic and operand explanations for partial context.','Do not infer a register result or memory effect from this generic fallback.'],'Not available',[],[],'Unsupported: no execution semantics inferred.');
}
