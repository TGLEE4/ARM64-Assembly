import type { ParsedInstruction } from './explainEngine';
import { parseImmediate, unsignedAtWidth, registerWidth } from './numeric';

export type Relationship = {
  line: number;
  mnemonic: string;
  title: string;
  explanation: string;
  sources: number[];
  status: 'known' | 'symbolic' | 'boundary';
  detail?: string;
};
export type RelationshipAnalysis = { items: Relationship[]; stoppedAt: number | null };
type RegisterValue = { known: bigint | null; origin: number | null; description: string };
type Flags = { equal: boolean | null; origin: number };
const registerPattern = /^(?:[WX](?:[0-9]|[12][0-9]|30)|SP|WSP|FP|LR|XZR|WZR)$/i;
const norm = (value:string) => {
  const s = value.trim().toUpperCase().replace(/^FP$/, 'X29').replace(/^LR$/, 'X30');
  return s.replace(/^W(?=\d+$)/,'X').replace(/^WSP$/,'SP');
};
const isReg = (value:string) => registerPattern.test(value.trim());
const getDependencies=(...values:(RegisterValue | undefined)[])=>
  [...new Set(values.flatMap(value=>value?.origin===null || value?.origin===undefined ? [] : [value.origin]))].sort((a,b)=>a-b);

/** Straight-line *explanation*, not a CPU emulator or control-flow reconstruction. */
export function analyzeRelationships(instructions: ParsedInstruction[]): RelationshipAnalysis {
  const registers = new Map<string, RegisterValue>();
  const items:Relationship[] = [];
  let flags:Flags | null = null;
  let stoppedAt:number|null=null;
  const read = (operand:string):RegisterValue => {
    const name=operand.trim().toUpperCase();
    const imm=parseImmediate(name);
    if(imm!==null) return {known:imm,origin:null,description:`immediate ${name}`};
    if(name==='XZR'||name==='WZR') return {known:0n,origin:null,description:'architectural zero register'};
    if(!isReg(name)) return {known:null,origin:null,description:`unresolved operand ${name}`};
    const value=registers.get(norm(name));
    if(!value) return {known:null,origin:null,description:`${name} has no supplied value`};
    if(name.startsWith('W')&&value.known!==null) return {...value,known:unsignedAtWidth(value.known,32)};
    return value;
  };
  const write=(destination:string, known:bigint|null, line:number, description:string)=>{
    const name=destination.trim().toUpperCase();
    if(!isReg(name)||name==='XZR'||name==='WZR') return;
    registers.set(norm(name),{known:known===null?null:unsignedAtWidth(known,registerWidth(name)),origin:line,description});
  };
  const emit=(inst:ParsedInstruction,title:string,explanation:string,status:Relationship['status'],sources:number[]=[],detail?:string)=>
    items.push({line:inst.id,mnemonic:inst.mnemonic,title,explanation,status,sources,detail});
  for(const inst of instructions){
    const op=inst.mnemonic,a=inst.operands,line=inst.id;
    if(inst.error){emit(inst,'Cannot analyze malformed instruction',inst.error,'boundary');stoppedAt=line;break;}
    // Unknown writes to a base register make all subsequent provenance unreliable.
    if(/^(?:LDR|STR|LDUR|STUR|LDP|STP)/.test(op) && (a.some(x=>/\]!\s*$/.test(x)) || a.length>(/^(?:LDP|STP)$/.test(op)?3:2))){
      emit(inst,'Memory writeback boundary','This addressing mode modifies the base register. Relationship analysis stops rather than reuse an outdated address.','boundary');stoppedAt=line;break;
    }
    if(op==='MOV'&&a.length===2&&isReg(a[0])){
      const src=read(a[1]);write(a[0],src.known,line,`copied from ${a[1]}`);
      emit(inst,'Value copied',`${a[0]} receives ${src.known===null?'an unknown value':src.known.toString()} from ${a[1]}.`,src.known===null?'symbolic':'known',getDependencies(src),`This instruction now defines ${a[0]}.`);
    }else if(op==='MOVZ'&&a.length>=2&&a.length<=3&&isReg(a[0])){
      const imm=parseImmediate(a[1]);const shift=a.length===3?a[2].match(/^LSL\s+#(0|16|32|48)$/i):null;
      const bits=a.length===2?0:shift?Number(shift[1]):null;
      if(imm===null||imm<0n||imm>65535n||bits===null||bits>=registerWidth(a[0])){
        emit(inst,'Unsupported MOVZ form','Cannot safely calculate this immediate or shift.','boundary');stoppedAt=line;break;
      }
      const result=imm<<BigInt(bits);write(a[0],result,line,'wide zero-filled immediate');
      emit(inst,'Constant constructed',`${a[0]} becomes ${result.toString()} (0x${result.toString(16).toUpperCase()}).`,'known');
    }else if(op==='MOVK'&&a.length>=2&&a.length<=3&&isReg(a[0])){
      const prev=read(a[0]),imm=parseImmediate(a[1]);const shift=a.length===3?a[2].match(/^LSL\s+#(0|16|32|48)$/i):null;
      const bits=a.length===2?0:shift?Number(shift[1]):null;
      if(imm===null||imm<0n||imm>65535n||bits===null||bits>=registerWidth(a[0])){
        emit(inst,'Unsupported MOVK form','Cannot safely calculate this immediate or shift.','boundary');stoppedAt=line;break;
      }
      const value=prev.known===null?null:(prev.known&~(65535n<<BigInt(bits)))|(imm<<BigInt(bits));
      write(a[0],value,line,'previous value with a 16-bit segment replaced');
      emit(inst,'Existing value modified',`This instruction replaces bits ${bits}–${bits+15} of ${a[0]}. ${value===null?'The other bits are unknown.':`The new value is ${value.toString()}.`}`,value===null?'symbolic':'known',getDependencies(prev));
    }else if(['ADD','SUB','AND','ORR','EOR','MUL','LSL','LSR','ASR'].includes(op)&&a.length===3&&isReg(a[0])){
      const left=read(a[1]),right=read(a[2]),width=registerWidth(a[0]);
      let result:bigint|null=null;
      if(left.known!==null&&right.known!==null){
        const x=unsignedAtWidth(left.known,width),y=right.known;
        if(op==='ADD') result=x+y;
        if(op==='SUB') result=x-y;
        if(op==='AND') result=x&y;
        if(op==='ORR') result=x|y;
        if(op==='EOR') result=x^y;
        if(op==='MUL') result=x*y;
        if(['LSL','LSR','ASR'].includes(op)&&y>=0n&&y<BigInt(width)){
          if(op==='LSL')result=x<<y;
          if(op==='LSR')result=x>>y;
          if(op==='ASR')result=BigInt.asIntN(width,x)>>y;
        }
      }
      write(a[0],result,line,`${op} of ${a[1]} and ${a[2]}`);
      emit(inst,'Inputs combined',`${a[0]} is calculated from ${a[1]} and ${a[2]}. ${result===null?'One or more input values are unknown or outside the modeled form.':`The calculated result is ${unsignedAtWidth(result,width).toString()}.`}`,result===null?'symbolic':'known',getDependencies(left,right));
    }else if(op==='LDR'&&a.length===2&&isReg(a[0])&&/^\[/.test(a[1])){
      const base=a[1].match(/^\[\s*([WX]\d+|SP|FP)\b/i);
      const baseValue=base?read(base[1]):undefined;
      write(a[0],null,line,`memory read ${a[1]}`);
      emit(inst,'Memory value loaded',`${a[0]} receives data from ${a[1]}. Its exact value is unknown because no memory snapshot was provided.`,'symbolic',getDependencies(baseValue),`A following comparison using ${a[0]} depends on this read.`);
    }else if(op==='CMP'&&a.length===2&&isReg(a[0])){
      const left=read(a[0]),right=read(a[1]);
      const width=registerWidth(a[0]);
      const equal=left.known!==null&&right.known!==null?unsignedAtWidth(left.known,width)===unsignedAtWidth(right.known,width):null;
      flags={equal,origin:line};
      emit(inst,'Comparison sets condition flags',`CMP compares ${a[0]} with ${a[1]}. ${equal===null?'At least one value is unknown, so equality cannot be determined.':`The supplied values ${equal?'are equal':'are not equal'}.`}`,equal===null?'symbolic':'known',getDependencies(left,right),`A later B.EQ or B.NE reads the flags set here; CMP does not overwrite ${a[0]}.`);
    }else if(/^B\.(?:EQ|NE)$/.test(op)&&a.length===1){
      const wantEqual=op==='B.EQ';const result=flags?.equal===null||flags?.equal===undefined?null:(flags.equal===wantEqual);
      emit(inst,'Conditional branch depends on earlier flags',`${op} checks ${wantEqual?'whether the zero flag is set':'whether the zero flag is clear'}. ${result===null?'The branch outcome is not established.':`Given only the modeled values, the condition would be ${result?'true':'false'}.`} The target is ${a[0]}.`,'boundary',flags?[flags.origin]:[],`This is a condition evaluation, not proof of an observed runtime branch.`);
      stoppedAt=line;break;
    }else if(['CBZ','CBNZ'].includes(op)&&a.length===2&&isReg(a[0])){
      const reg=read(a[0]);const yes=reg.known===null?null:(op==='CBZ'?reg.known===0n:reg.known!==0n);
      emit(inst,'Branch directly tests a register',`${op} tests ${a[0]} against zero without changing NZCV. ${yes===null?'Its value is unknown.':`The condition would be ${yes?'true':'false'} given the modeled value.`}`,'boundary',getDependencies(reg),`Branch target: ${a[1]}. No later instruction is assumed to execute.`);
      stoppedAt=line;break;
    }else if(/^(?:B(?:\.[A-Z]+)?|BL|BR|BLR|RET|TBZ|TBNZ)$/.test(op)){
      emit(inst,'Control-flow boundary',`${op} can change which instruction runs next. The current analyzer does not follow possible execution paths.`,'boundary');stoppedAt=line;break;
    }else if(op==='STR'&&a.length===2&&/^\[/.test(a[1])){
      const source=read(a[0]);emit(inst,'Memory write uses a value',`${a[0]} is written to memory at ${a[1]}. The memory contents are not observed.`,'symbolic',getDependencies(source));
    }else{
      // Unsupported instructions may modify registers/flags or change control flow.
      emit(inst,'Unsupported instruction boundary',`${op || 'This instruction'} is not modeled here. Analysis stops to avoid inventing dependencies.`,'boundary');stoppedAt=line;break;
    }
  }
  return {items,stoppedAt};
}
