
export interface OperandInfo {
  value: string;
  type: string;
  explanation: string;
  details: string[];
}

export function splitOperands(input: string): string[] {
  const result: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of input) {
    if (char === "[") depth++;
    if (char === "]") depth--;

    if (char === "," && depth === 0) {
      if (current.trim()) result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) result.push(current.trim());

  return result;
}

export function analyzeOperand(value: string): OperandInfo {
  const operand = value.trim().toUpperCase();

  const register = operand.match(/^([WX])([0-9]|[12][0-9]|30)$/);

  if (register) {
    const is64Bit = register[1] === "X";

    return {
      value: operand,
      type: "Register",
      explanation: `A ${is64Bit ? 64 : 32}-bit ARM64 general-purpose register.`,
      details: [
        "Registers are small storage locations inside the CPU.",
        `${operand} can hold a value used by an instruction.`,
        is64Bit
          ? "X registers hold 64-bit values."
          : "W registers represent the lower 32 bits of their corresponding X registers.",
        "Its role as a source or destination depends on the instruction.",
      ],
    };
  }

  if (/^#-?(0X[0-9A-F]+|\d+)$/i.test(operand)) {
    const raw = operand.slice(1);
    const number = BigInt(raw);

    return {
      value: operand,
      type: "Immediate Value",
      explanation: "A fixed number written directly inside the instruction.",
      details: [
        `Decimal value: ${number.toString(10)}`,
        `Hexadecimal value: 0x${number.toString(16).toUpperCase()}`,
        "The # symbol indicates an immediate value in ARM64 assembly syntax.",
      ],
    };
  }

  if (/^\[.+\]!?$/.test(operand)) {
    const inner = operand.replace(/^\[/, "").replace(/\]!?$/, "");
    const parts = splitOperands(inner);
    const base = parts[0] ?? "Unknown";
    const offset = parts[1];

    return {
      value: operand,
      type: "Memory Operand",
      explanation:
        "Describes a memory address that an instruction accesses.",
      details: [
        `Base register: ${base}`,
        offset ? `Offset expression: ${offset}` : "No explicit offset.",
        "Square brackets mean the instruction uses an address to access memory.",
        "Whether memory is read or written depends on the mnemonic.",
      ],
    };
  }

  return {
    value: operand,
    type: "Other / Unrecognized",
    explanation:
      "This operand needs additional instruction-specific analysis.",
    details: [
      "It may be a label, condition, shifted register, or unsupported operand form.",
    ],
  };
}
