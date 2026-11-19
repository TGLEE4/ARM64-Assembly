export type ParsedInstruction = { id: number; raw: string; mnemonic: string; operands: string[]; error?: string };
export type OperandPart = { text: string; kind: string; detail: string };
export type MnemonicExplanation = { name: string; title: string; plain: string; technical: string; effect: string; example: string };

// Keep all expression splitting depth-aware. Commas inside [base, offset] are not operand separators.
export function splitOperands(input: string): string[] {
  const out: string[] = []; let part = ''; let depth = 0;
  for (const char of input) {
    if (char === '[') depth++;
    if (char === ']') depth--;
    if (depth < 0) throw new Error('Unmatched closing bracket in operands.');
    if (char === ',' && depth === 0) { if (part.trim()) out.push(part.trim()); part = ''; }
    else part += char;
  }
  if (depth !== 0) throw new Error('Unmatched opening bracket in operands.');
  if (part.trim()) out.push(part.trim());
  return out;
}

export function parseInstructions(text: string): ParsedInstruction[] {
  return text.split(/\r?\n/).map((line, n): ParsedInstruction | null => {
    const cleaned = line.replace(/\/\/.*$/, '').replace(/;.*$/, '').trim();
    if (!cleaned || /^(?:[\w.$]+):$/.test(cleaned)) return null;
    // Support common address prefix from disassembly exports; avoid claiming byte decoding.
    const noAddress = cleaned.replace(/^(?:0x)?[0-9a-f]{6,16}:\s*/i, '');
    const match = noAddress.match(/^([a-z][a-z0-9.]*)\b\s*(.*)$/i);
    if (!match) return { id: n, raw: cleaned, mnemonic: '', operands: [], error: 'Could not parse the instruction. Paste ARM64 assembly rather than raw hex.' };
    try { return { id: n, raw: cleaned, mnemonic: match[1].toUpperCase(), operands: splitOperands(match[2]) }; }
    catch (error) { return { id: n, raw: cleaned, mnemonic: match[1].toUpperCase(), operands: [], error: (error as Error).message }; }
  }).filter((item): item is ParsedInstruction => item !== null);
}

const dictionary: Record<string, Omit<MnemonicExplanation,'name'>> = {
  LDR: {title:'Load Register',plain:'Read data from memory and place it into a register.', technical:'The effective address is calculated using the memory operand. The loaded width depends on the instruction form and destination register.', effect:'Reads memory; changes destination register; normally does not change NZCV flags.',example:'LDR W8, [X19, #0x200] → read four bytes at X19 + 512 into W8.'},
  STR: {title:'Store Register',plain:'Take a value from a register and write it into memory.',technical:'The effective address comes from the memory operand, and the transfer width depends on the instruction form.',effect:'Writes memory; the source register is not overwritten; pre/post-indexing may update the base register.',example:'STR W8, [X19, #0x200] → write four bytes from W8 to memory.'},
  LDP: {title:'Load Pair',plain:'Read two nearby values from memory into two registers.',technical:'Transfers a pair of registers using a shared memory addressing expression.',effect:'Reads memory, writes two destination registers, and may update the base with writeback.',example:'LDP X29, X30, [SP], #16 → load two registers, then advance SP by 16.'},
  STP: {title:'Store Pair',plain:'Write two registers to nearby memory locations.',technical:'Transfers a pair of registers using one memory addressing expression.',effect:'Writes memory and may update the base register with writeback.',example:'STP X29, X30, [SP, #-16]! → adjust SP and save X29/X30.'},
  MOV: {title:'Move',plain:'Copy a value into a register; the source is not erased.',technical:'MOV is an assembler alias for several supported machine instructions depending on the operand form.',effect:'Changes destination; ordinarily leaves NZCV unchanged.',example:'MOV W0, #1 → put the number 1 in W0.'},
  MOVZ: {title:'Move Wide with Zero',plain:'Build a register value from a 16-bit number and clear the other bits.',technical:'Places a 16-bit immediate in an optionally shifted halfword, zeroing remaining bits.',effect:'Changes destination register.',example:'MOVZ X0, #0x1234 → X0 becomes 0x1234.'},
  MOVK: {title:'Move Wide with Keep',plain:'Replace one 16-bit section of a register but keep the other sections.',technical:'Writes one selected halfword while preserving the rest of the destination.',effect:'Partially changes destination register.',example:'MOVK X0, #0xABCD, LSL #16 → replace bits 16–31.'},
  ADD: {title:'Add',plain:'Add two numbers and save the result.',technical:'Destination = first source + second source, using the selected register width.',effect:'Writes destination; without S does not update NZCV flags.',example:'ADD X0, X1, #16 → X0 becomes X1 + 16.'},
  ADDS: {title:'Add and Set Flags',plain:'Add values and update the CPU condition flags.',technical:'Performs addition while setting N, Z, C and V.',effect:'Writes destination and NZCV.',example:'ADDS W0, W1, #1 → add one and record condition flags.'},
  SUB: {title:'Subtract',plain:'Subtract the second input from the first and save the result.',technical:'Destination = first source − second source.',effect:'Writes destination; normally does not update NZCV.',example:'SUB X0, X1, #8 → X0 becomes X1 − 8.'},
  SUBS: {title:'Subtract and Set Flags',plain:'Subtract values, store the result, and update flags.',technical:'Performs subtraction and writes NZCV.',effect:'Writes destination and NZCV.',example:'SUBS W0, W1, #1 → subtract one and update flags.'},
  CMP: {title:'Compare',plain:'Check the relationship between two values without replacing either one.',technical:'Alias of SUBS with a zero-register destination: calculates subtraction to update NZCV, discarding the result.',effect:'Updates NZCV; does not store the difference.',example:'CMP W8, #0 → determine whether W8 equals zero using flags.'},
  CMN: {title:'Compare Negative',plain:'Check values using addition and update flags.',technical:'Alias of ADDS with a zero-register destination.',effect:'Updates NZCV; discards addition result.',example:'CMN W0, #1 → set flags for W0 + 1.'},
  TST: {title:'Test Bits',plain:'Check which bits two values have in common.',technical:'Alias of ANDS with a zero-register destination.',effect:'Updates NZCV; does not save AND result.',example:'TST W8, #1 → test whether the low bit is set.'},
  AND: {title:'Bitwise AND',plain:'Keep only bits that are set in both inputs.',technical:'Performs bitwise conjunction.',effect:'Writes destination.',example:'AND W0, W1, #0xFF → retain the low eight bits.'},
  ORR: {title:'Bitwise OR',plain:'Keep bits that are set in either input.',technical:'Performs bitwise inclusive OR.',effect:'Writes destination.',example:'ORR W0, W1, W2 → combine set bits.'},
  EOR: {title:'Exclusive OR',plain:'Set a bit when the two inputs have different bits there.',technical:'Performs bitwise exclusive OR.',effect:'Writes destination.',example:'EOR W0, W1, W2 → XOR input values.'},
  ADR: {title:'Address Relative to PC',plain:'Calculate the address of something near this instruction.',technical:'Adds a signed immediate to the current PC.',effect:'Writes address to destination register.',example:'ADR X0, label → X0 gets address of label.'},
  ADRP: {title:'Address of PC-relative Page',plain:'Calculate the base address of a nearby 4 KB page.',technical:'Adds a page-scaled offset to the PC with its bottom 12 bits cleared.',effect:'Writes a page base to destination; often followed by ADD or LDR.',example:'ADRP X0, label → get page; ADD X0, X0, :lo12:label → complete address.'},
  B: {title:'Branch',plain:'Jump to another instruction instead of continuing in sequence.',technical:'Transfers control to a PC-relative target.',effect:'Changes control flow.',example:'B target → jump to target.'},
  BL: {title:'Branch with Link',plain:'Call code elsewhere and remember where to return.',technical:'Places address of next instruction in X30 (LR) and branches.',effect:'Changes PC and X30.',example:'BL function → call function and save return address.'},
  BR: {title:'Branch to Register',plain:'Jump to the address held in a register.',technical:'Indirect branch through a register.',effect:'Changes PC.',example:'BR X16 → jump to address in X16.'},
  BLR: {title:'Branch with Link to Register',plain:'Call the function whose address is in a register.',technical:'Indirect call; saves return address to X30.',effect:'Changes PC and X30.',example:'BLR X16 → call the address in X16.'},
  RET: {title:'Return',plain:'Go back to the caller.',technical:'Indirect branch to specified register, default X30 (LR).',effect:'Changes control flow; does not itself set a return value.',example:'RET → return to address in X30.'},
  CBZ: {title:'Compare and Branch if Zero',plain:'Jump only when a register contains zero.',technical:'Tests a register directly without setting NZCV.',effect:'May branch; preserves NZCV.',example:'CBZ W8, target → jump if W8 is zero.'},
  CBNZ: {title:'Compare and Branch if Not Zero',plain:'Jump only when a register is not zero.',technical:'Tests a register directly without setting NZCV.',effect:'May branch; preserves NZCV.',example:'CBNZ W8, target → jump if W8 is nonzero.'},
  TBZ: {title:'Test Bit and Branch if Zero',plain:'Jump if a particular bit is zero.',technical:'Tests the selected bit of a register, without modifying NZCV.',effect:'May branch; preserves NZCV.',example:'TBZ W8, #2, target → jump if bit 2 is clear.'},
  TBNZ: {title:'Test Bit and Branch if Not Zero',plain:'Jump if a particular bit is one.',technical:'Tests the selected bit of a register, without modifying NZCV.',effect:'May branch; preserves NZCV.',example:'TBNZ W8, #2, target → jump if bit 2 is set.'},
  CSEL: {title:'Conditional Select',plain:'Choose one of two values based on the condition flags.',technical:'Selects source one or two based on NZCV condition evaluation.',effect:'Writes destination; does not branch.',example:'CSEL W0, W1, W2, EQ → W0 = W1 if equal, otherwise W2.'},
  CSET: {title:'Conditional Set',plain:'Turn a flag condition into a 1 or 0.',technical:'Alias of conditional-select increment with zero register operands.',effect:'Writes destination.',example:'CSET W0, EQ → W0 = 1 if equal, else 0.'},
  LSL: {title:'Logical Shift Left',plain:'Move bits left and fill the right with zeros.',technical:'Shift the source left by a given bit count.',effect:'Writes destination.',example:'LSL W0, W1, #2 → shift left two bits.'},
  LSR: {title:'Logical Shift Right',plain:'Move bits right and fill the left with zeros.',technical:'Shift an unsigned bit pattern right.',effect:'Writes destination.',example:'LSR W0, W1, #2 → shift right two bits.'},
  ASR: {title:'Arithmetic Shift Right',plain:'Move bits right while keeping the sign.',technical:'Sign-preserving right shift.',effect:'Writes destination.',example:'ASR W0, W1, #2 → shift signed value right.'},
  MUL: {title:'Multiply',plain:'Multiply two values.',technical:'Produces the low register-width bits of the product.',effect:'Writes destination.',example:'MUL W0, W1, W2 → W0 = W1 × W2.'},
  NOP: {title:'No Operation',plain:'Do nothing and move to the next instruction.',technical:'Architecturally defined no-operation hint.',effect:'No general-purpose register or memory result.',example:'NOP → continue.'},
};

export function mnemonicInfo(op: string): MnemonicExplanation | null {
  const name = op.toUpperCase();
  const d = dictionary[name];
  if (d) return { name, ...d };
  if (/^B\.(EQ|NE|CS|CC|HS|LO|MI|PL|VS|VC|HI|LS|GE|LT|GT|LE)$/.test(name)) return {name,title:'Conditional Branch',plain:'Jump when the named condition is satisfied.',technical:'Reads the NZCV flags set by an earlier instruction.',effect:'May change control flow; does not update NZCV.',example:`${name} target → jump if the ${name.slice(2)} condition holds.`};
  if (/^(LDR|LDUR)(B|H|SB|SH|SW)?$/.test(name)) return {name,title:'Load from Memory',plain:'Read memory into a register.',technical:'Transfer size and sign-extension depend on the instruction suffix.',effect:'Reads memory and changes a destination register.',example:`${name} W0, [X1] → read from memory according to the specified width.`};
  if (/^(STR|STUR)(B|H)?$/.test(name)) return {name,title:'Store to Memory',plain:'Write register data into memory.',technical:'Transfer size depends on the instruction suffix.',effect:'Writes memory.',example:`${name} W0, [X1] → write data to memory.`};
  return null;
}

export function roleOfOperand(inst: ParsedInstruction, index: number): string {
  const op = inst.mnemonic, token = inst.operands[index] || '';
  const load = /^(LDR|LDUR|LDP)/.test(op), store = /^(STR|STUR|STP)/.test(op);
  if (op === 'LDP' || op === 'STP') return index < 2 ? (load ? 'Destination register' : 'Source register') : 'Memory address';
  if (load || store) { if (token.trim().startsWith('[')) return load ? 'Memory source' : 'Memory destination'; if (index === 0) return load ? 'Destination register' : 'Source register'; return 'Addressing / writeback offset'; }
  if (['CMP','CMN','TST'].includes(op)) return index === 0 ? 'First value being tested' : 'Second value being tested';
  if (op === 'CBZ' || op === 'CBNZ') return index === 0 ? 'Register being checked' : 'Branch target';
  if (op === 'TBZ' || op === 'TBNZ') return ['Register being checked','Bit index','Branch target'][index] ?? 'Operand';
  if (['B','BL'].includes(op) || op.startsWith('B.')) return 'Branch target';
  if (['BR','BLR','RET'].includes(op)) return 'Address-holding register';
  if (['CSET'].includes(op)) return index === 0 ? 'Destination register' : 'Condition';
  if (['MOVK','MOVZ'].includes(op) && index === 2) return 'Shift modifier';
  if (index === 0) return 'Destination register (common form)';
  return `Source / modifier ${index}`;
}

function integerInfo(raw: string): string | null {
  try { const n = BigInt(raw.replace(/^#/, '')); const sign = n < 0n ? '-' : ''; const abs = n < 0n ? -n : n; return `${n.toString(10)} decimal (${sign}0x${abs.toString(16).toUpperCase()} hexadecimal)`; } catch { return null; }
}
export function inspectToken(token: string, role = 'Operand'): OperandPart {
  const text = token.trim(), upper = text.toUpperCase();
  if (/^(?:[XW](?:[0-9]|[12][0-9]|30)|SP|WSP|FP|LR|XZR|WZR)$/.test(upper)) {
    const width = upper.startsWith('W') ? 32 : 64;
    let detail = `${upper} is a ${width}-bit register. Its current value is unknown without prior instructions or a register snapshot.`;
    if (/^W\d+$/.test(upper)) detail += ' Writing Wn clears the upper 32 bits of the corresponding Xn.';
    if (/^(XZR|WZR)$/.test(upper)) detail = `${upper} is a zero register: reading gives zero and writes are discarded.`;
    if (/^(SP|WSP)$/.test(upper)) detail = 'Stack pointer: used as the base address for stack storage.';
    if (upper === 'LR') detail = 'Link register alias for X30, often storing the address to return to.';
    if (upper === 'FP') detail = 'Frame pointer alias for X29; often points to the current stack frame.';
    return {text,kind:'Register',detail:`${role}. ${detail}`};
  }
  if (/^#?-?(?:0x[0-9a-f]+|\d+)$/i.test(text)) return {text,kind:'Immediate / number',detail:`${role}. Fixed numeric value: ${integerInfo(text)}. The # marks an immediate in assembly syntax; its units depend on the instruction.`};
  if (/^\[.*\]!?$/s.test(text)) return {text,kind:'Memory addressing',detail:`${role}. Square brackets describe an address to access in memory, rather than the register's own numeric value. The base register supplies an address; any offset modifies it. Actual memory contents are unknown without a snapshot.`};
  if (/^(?:LSL|LSR|ASR|ROR|UXTW|SXTW|UXTX|SXTX)\b/i.test(text)) return {text,kind:'Shift / extension',detail:`${role}. Adjusts an operand before the instruction uses it. A shift amount counts bits, not bytes.`};
  if (/^(?:EQ|NE|CS|CC|HS|LO|MI|PL|VS|VC|HI|LS|GE|LT|GT|LE)$/i.test(text)) return {text,kind:'Condition code',detail:`${role}. Uses the processor's NZCV condition flags. The flag values are not known from this instruction alone.`};
  return {text,kind:'Label / expression / unsupported form',detail:`${role}. This might be a branch label, symbolic expression, or more complex operand. The tool cannot establish its meaning from this text alone.`};
}
export function memoryParts(token: string): OperandPart[] {
  const result = [inspectToken(token, 'Full memory operand')];
  const match = token.match(/^\[(.*)\](!)?$/s); if (!match) return result;
  let inside: string[];
  try { inside = splitOperands(match[1]); } catch { return result; }
  for (let i = 0; i < inside.length; i++) result.push(inspectToken(inside[i], i === 0 ? 'Base register' : i === 1 ? 'Address offset or index' : 'Address modifier'));
  if (match[2]) result.push({text:'!',kind:'Pre-index writeback',detail:'The exclamation mark means the base register is updated to the computed address as part of this memory operation.'});
  return result;
}
export function workedExample(inst: ParsedInstruction): string {
  const a = inst.operands, op = inst.mnemonic;
  if (/^(LDR|STR)$/.test(op) && a.length >= 2) {
    const m = a[1].match(/^\[([^,\]]+)(?:,\s*(#[+-]?(?:0x[0-9a-f]+|\d+)))?\]$/i);
    if (m) {
      const offset = m[2] ? integerInfo(m[2]) : '0 bytes';
      const width = a[0].trim().toUpperCase().startsWith('W') ? '4 bytes' : '8 bytes';
      return `1. Start with the address currently held in ${m[1]} (its actual value is unknown).\n2. Add the offset ${offset}.\n3. ${op === 'LDR' ? `Read ${width} of memory at that address into ${a[0]}.` : `Write ${width} from ${a[0]} to memory at that address.`}\n4. This example does not invent memory values or register contents.`;
    }
  }
  if (op === 'CMP' && a.length >= 2) return `1. Compare ${a[0]} with ${a[1]} by evaluating a subtraction.\n2. Record N, Z, C and V flags for the selected width.\n3. Keep both input operands unchanged.\n4. A later conditional branch can use those flags.`;
  if (op === 'ADD' && a.length >= 3) return `1. Read ${a[1]}.\n2. Add ${a[2]}.\n3. Write the result into ${a[0]}.\nThe source value is unknown until you provide the earlier register state.`;
  if (op === 'RET') return '1. Read the address from X30 unless another register is specified.\n2. Continue execution at that address.\nThe destination cannot be determined without runtime context.';
  return 'A numerical walkthrough is not available for this particular instruction form yet. Its documented architectural behavior is shown above; no register values are assumed.';
}
