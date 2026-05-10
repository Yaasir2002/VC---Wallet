import * as bip39 from 'bip39';

export const MNEMONIC_WORD_COUNT = 12;

export function normalizeMnemonic(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function splitMnemonicWords(value: string): string[] {
  const normalized = normalizeMnemonic(value);

  if (!normalized) {
    return [];
  }

  return normalized.split(' ');
}

export function generateMnemonic12Words(): string {
  return bip39.generateMnemonic(128);
}

export function validateMnemonic12Words(value: string): {
  valid: boolean;
  normalizedMnemonic: string;
  error?: string;
} {
  const normalizedMnemonic = normalizeMnemonic(value);
  const words = splitMnemonicWords(normalizedMnemonic);

  if (words.length !== MNEMONIC_WORD_COUNT) {
    return {
      valid: false,
      normalizedMnemonic,
      error: 'Recovery phrase wajib terdiri dari 12 kata.',
    };
  }

  const isValid = bip39.validateMnemonic(normalizedMnemonic);

  if (!isValid) {
    return {
      valid: false,
      normalizedMnemonic,
      error: 'Recovery phrase tidak valid. Periksa kembali urutan katanya.',
    };
  }

  return {
    valid: true,
    normalizedMnemonic,
  };
}

export async function mnemonicToSeedHex(mnemonic: string): Promise<string> {
  const normalized = normalizeMnemonic(mnemonic);
  const seed = await bip39.mnemonicToSeed(normalized);

  return Buffer.from(seed).toString('hex');
}