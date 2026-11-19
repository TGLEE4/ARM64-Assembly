
export interface MnemonicInfo {
  name: string;
  fullName: string;
  explanation: string;
  example: string;
}

export const mnemonics: Record<string, MnemonicInfo> = {
  LDR: {
    name: "LDR",
    fullName: "Load Register",
    explanation:
      "Reads a value from memory and places it into a register.",
    example: "LDR W8, [X19, #0x200]",
  },

  STR: {
    name: "STR",
    fullName: "Store Register",
    explanation:
      "Takes a value from a register and writes it into memory.",
    example: "STR W8, [X19, #0x200]",
  },

  MOV: {
    name: "MOV",
    fullName: "Move",
    explanation:
      "Copies a value into a destination register.",
    example: "MOV W0, #1",
  },

  ADD: {
    name: "ADD",
    fullName: "Add",
    explanation:
      "Adds two values and stores the result in a destination register.",
    example: "ADD X0, X1, #0x10",
  },

  SUB: {
    name: "SUB",
    fullName: "Subtract",
    explanation:
      "Subtracts one value from another and stores the result.",
    example: "SUB X0, X1, #0x10",
  },

  CMP: {
    name: "CMP",
    fullName: "Compare",
    explanation:
      "Compares two values by subtracting them internally. It updates condition flags without storing the subtraction result.",
    example: "CMP W8, #0",
  },

  BL: {
    name: "BL",
    fullName: "Branch with Link",
    explanation:
      "Calls another code location and saves the return address in the link register.",
    example: "BL 0x10040",
  },

  RET: {
    name: "RET",
    fullName: "Return",
    explanation:
      "Returns execution to the address held in a register, normally X30.",
    example: "RET",
  },

  ADRP: {
    name: "ADRP",
    fullName: "Address of Page",
    explanation:
      "Calculates a PC-relative page address and stores it in a register.",
    example: "ADRP X0, 0x100010000",
  },
};

export function getMnemonicInfo(
  mnemonic: string
): MnemonicInfo | undefined {
  return mnemonics[mnemonic.trim().toUpperCase()];
}
