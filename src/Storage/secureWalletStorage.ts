import * as SecureStore from 'expo-secure-store';

import {
  RecoverableWalletIdentity,
  WalletRecoveryBackupState,
} from '../types/walletRecovery';
import { DIDData } from '../Services/didService';
import { saveDID, deleteDID } from './didStorage';
import { safeLogger } from '../utils/safeLogger';

const WALLET_MNEMONIC_KEY = 'RECOVERABLE_WALLET_MNEMONIC_V1';
const WALLET_PRIVATE_KEY_SEED_KEY = 'RECOVERABLE_WALLET_PRIVATE_KEY_SEED_V1';
const WALLET_IDENTITY_KEY = 'RECOVERABLE_WALLET_IDENTITY_V1';
const WALLET_BACKUP_STATE_KEY = 'RECOVERABLE_WALLET_BACKUP_STATE_V1';

const secureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function toDIDData(identity: RecoverableWalletIdentity): DIDData {
  return {
    did: identity.did,
    provider: identity.provider,
    alias: identity.alias,
    method: identity.method,
    network: identity.network,
    controllerKeyId: identity.controllerKeyId,
    createdAt: identity.createdAt,
  };
}

function safeParseJSON<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function saveEncryptedMnemonic(mnemonic: string): Promise<void> {
  await SecureStore.setItemAsync(
    WALLET_MNEMONIC_KEY,
    mnemonic,
    secureStoreOptions
  );
}

export async function getEncryptedMnemonic(): Promise<string | null> {
  return await SecureStore.getItemAsync(WALLET_MNEMONIC_KEY);
}

export async function saveWalletIdentity(
  identity: RecoverableWalletIdentity
): Promise<void> {
  await SecureStore.setItemAsync(
    WALLET_IDENTITY_KEY,
    JSON.stringify(identity),
    secureStoreOptions
  );

  await SecureStore.setItemAsync(
    WALLET_PRIVATE_KEY_SEED_KEY,
    identity.privateKeySeedHex,
    secureStoreOptions
  );

  await saveDID(toDIDData(identity));
}

export async function getRecoverableWalletIdentity(): Promise<RecoverableWalletIdentity | null> {
  const raw = await SecureStore.getItemAsync(WALLET_IDENTITY_KEY);
  return safeParseJSON<RecoverableWalletIdentity>(raw);
}

export async function getWalletPrivateKeySeedHex(): Promise<string | null> {
  return await SecureStore.getItemAsync(WALLET_PRIVATE_KEY_SEED_KEY);
}

export async function clearWalletIdentity(): Promise<void> {
  await SecureStore.deleteItemAsync(WALLET_MNEMONIC_KEY);
  await SecureStore.deleteItemAsync(WALLET_PRIVATE_KEY_SEED_KEY);
  await SecureStore.deleteItemAsync(WALLET_IDENTITY_KEY);
  await SecureStore.deleteItemAsync(WALLET_BACKUP_STATE_KEY);
  await deleteDID();
}

export async function markMnemonicBackedUp(): Promise<void> {
  const backupState: WalletRecoveryBackupState = {
    isBackedUp: true,
    backedUpAt: new Date().toISOString(),
  };

  await SecureStore.setItemAsync(
    WALLET_BACKUP_STATE_KEY,
    JSON.stringify(backupState),
    secureStoreOptions
  );
}

export async function getMnemonicBackupState(): Promise<WalletRecoveryBackupState> {
  const raw = await SecureStore.getItemAsync(WALLET_BACKUP_STATE_KEY);
  const parsed = safeParseJSON<WalletRecoveryBackupState>(raw);

  return {
    isBackedUp: parsed?.isBackedUp === true,
    backedUpAt: parsed?.backedUpAt,
  };
}

export async function hasStoredMnemonic(): Promise<boolean> {
  const mnemonic = await getEncryptedMnemonic();
  return Boolean(mnemonic);
}

export async function syncRecoverableIdentityToDidStorage(): Promise<void> {
  const identity = await getRecoverableWalletIdentity();

  if (!identity) {
    return;
  }

  try {
    await saveDID(toDIDData(identity));
  } catch {
    safeLogger.warn('Failed to sync recoverable identity to didStorage');
  }
}