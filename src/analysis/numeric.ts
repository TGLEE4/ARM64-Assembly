/** Parse a signed decimal/hex ARM64 immediate without relying on BigInt('-0x..'). */
export function parseImmediate(text: string): bigint | null {
  const raw = text.trim().replace(/^#/, '');
  const match = raw.match(/^([+-]?)(0x[0-9a-f]+|\d+)$/i);
  if (!match) return null;
  try {
    const value = BigInt(match[2]);
    return match[1] === '-' ? -value : value;
  } catch { return null; }
}

export function registerWidth(name: string): 32 | 64 {
  const normalized = name.toUpperCase();
  return normalized.startsWith('W') ? 32 : 64;
}

export function unsignedAtWidth(value: bigint, width: 32 | 64): bigint {
  return BigInt.asUintN(width, value);
}
