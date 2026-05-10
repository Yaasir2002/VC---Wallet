/**
 * walletIdentityService.ts
 *
 * Centralized service for managing the wallet holder's DID identity.
 *
 * Current architecture:
 * 1. New wallets are created from BIP39 mnemonic recovery phrase.
 * 2. The mnemonic deterministically derives an Ed25519 did:key identity.
 * 3. DID continuity is preserved because the same mnemonic restores the same DID.
 * 4. Legacy wallets that already have DID in didStorage are still supported.
 *
 * Security notes:
 * - DID is public and safe to display.
 * - Mnemonic and private key seed are stored only in SecureStore.
 * - This service never logs mnemonic or private keys.
 */

import { getDID, saveDID } from '../Storage/didStorage';
import { generateEthrDID } from './didService';
import { safeLogger } from '../utils/safeLogger';
import { getRecoverableWalletIdentity } from '../Storage/secureWalletStorage';
import { createWalletWithMnemonic } from './recoverableWalletIdentityService';

export type WalletIdentityStatus =
  | 'ready'
  | 'creating'
  | 'not_initialized'
  | 'error';

export type WalletIdentity = {
  did: string;
  provider: string;
  method: string;
  network: string;
  alias?: string;
  controllerKeyId?: string;
  createdAt: string;
  status: WalletIdentityStatus;
};

export async function getWalletIdentity(): Promise<WalletIdentity | null> {
  try {
    const recoverableIdentity = await getRecoverableWalletIdentity();

    if (recoverableIdentity?.did) {
      return {
        did: recoverableIdentity.did,
        provider: recoverableIdentity.provider,
        method: recoverableIdentity.method,
        network: recoverableIdentity.network,
        alias: recoverableIdentity.alias,
        controllerKeyId: recoverableIdentity.controllerKeyId,
        createdAt: recoverableIdentity.createdAt,
        status: 'ready',
      };
    }

    const didData = await getDID();

    if (!didData?.did) {
      return null;
    }

    return {
      ...didData,
      status: 'ready',
    };
  } catch {
    safeLogger.error('Failed to load wallet identity');
    return null;
  }
}

export async function ensureWalletIdentity(): Promise<WalletIdentity> {
  const existing = await getWalletIdentity();

  if (existing) {
    return existing;
  }

  safeLogger.info('No wallet identity found, generating mnemonic DID');

  const result = await createWalletWithMnemonic();

  return {
    did: result.identity.did,
    provider: result.identity.provider,
    method: result.identity.method,
    network: result.identity.network,
    alias: result.identity.alias,
    controllerKeyId: result.identity.controllerKeyId,
    createdAt: result.identity.createdAt,
    status: 'ready',
  };
}

/**
 * Legacy fallback only.
 * Use this when supporting old wallets that were created before mnemonic recovery.
 */
export async function ensureLegacyWalletIdentity(): Promise<WalletIdentity> {
  const existing = await getWalletIdentity();

  if (existing) {
    return existing;
  }

  const newDIDData = await generateEthrDID();
  await saveDID(newDIDData);

  return {
    ...newDIDData,
    status: 'ready',
  };
}

export async function getHolderDid(): Promise<string | null> {
  const identity = await getWalletIdentity();
  return identity?.did ?? null;
}

export async function getWalletIdentitySummary(): Promise<{
  did: string | null;
  shortDid: string | null;
  method: string | null;
  network: string | null;
  createdAt: string | null;
  isReady: boolean;
}> {
  const identity = await getWalletIdentity();

  if (!identity) {
    return {
      did: null,
      shortDid: null,
      method: null,
      network: null,
      createdAt: null,
      isReady: false,
    };
  }

  const did = identity.did;
  const shortDid =
    did.length > 32 ? `${did.slice(0, 14)}...${did.slice(-6)}` : did;

  return {
    did,
    shortDid,
    method: identity.method,
    network: identity.network,
    createdAt: identity.createdAt,
    isReady: true,
  };
}

export async function hasWalletIdentity(): Promise<boolean> {
  const identity = await getWalletIdentity();
  return identity !== null;
}