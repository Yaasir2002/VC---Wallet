import {
  generateMnemonic12Words,
  validateMnemonic12Words,
} from './mnemonicService';
import { deriveRecoverableDidKeyFromMnemonic } from './didKeyService';
import {
  saveEncryptedMnemonic,
  saveWalletIdentity,
  getEncryptedMnemonic,
  getRecoverableWalletIdentity,
  clearWalletIdentity,
} from '../Storage/secureWalletStorage';
import {
  CreateRecoverableWalletResult,
  RestoreRecoverableWalletResult,
} from '../types/walletRecovery';

export async function createWalletWithMnemonic(): Promise<CreateRecoverableWalletResult> {
  const mnemonic = generateMnemonic12Words();
  const identity = await deriveRecoverableDidKeyFromMnemonic(mnemonic);

  await saveEncryptedMnemonic(mnemonic);
  await saveWalletIdentity(identity);

  return {
    mnemonic,
    identity,
  };
}

export async function restoreWalletFromMnemonic(
  mnemonicInput: string
): Promise<RestoreRecoverableWalletResult> {
  const validation = validateMnemonic12Words(mnemonicInput);

  if (!validation.valid) {
    throw new Error(validation.error ?? 'Recovery phrase tidak valid.');
  }

  const identity = await deriveRecoverableDidKeyFromMnemonic(
    validation.normalizedMnemonic
  );

  await saveEncryptedMnemonic(validation.normalizedMnemonic);
  await saveWalletIdentity({
    ...identity,
    restoredAt: new Date().toISOString(),
  });

  return {
    identity,
  };
}

export async function getStoredMnemonicForBackup(): Promise<string> {
  const mnemonic = await getEncryptedMnemonic();

  if (!mnemonic) {
    throw new Error('Recovery phrase belum tersedia.');
  }

  return mnemonic;
}

export async function hasRecoverableWallet(): Promise<boolean> {
  const identity = await getRecoverableWalletIdentity();
  return Boolean(identity?.did);
}

export async function resetRecoverableWalletIdentity(): Promise<void> {
  await clearWalletIdentity();
}