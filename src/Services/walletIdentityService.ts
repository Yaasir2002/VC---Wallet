/**
 * walletIdentityService.ts
 *
 * Centralized service for managing the wallet holder's DID identity.
 *
 * Architecture:
 * 1. On first wallet setup (create-account), a did:ethr:sepolia DID is generated
 *    via Veramo and stored in didStorage (SecureStore).
 * 2. On subsequent app launches, the DID is loaded from didStorage.
 * 3. If the DID exists in didStorage but not in Veramo's agent (after a
 *    MemoryDIDStore → SecureDIDStore migration), the DID record is reconstructed.
 * 4. The DID is never regenerated if one already exists — preserving continuity.
 *
 * Security notes:
 * - The DID (public identifier) is safe to display.
 * - The private key is managed exclusively by SecurePrivateKeyStore.
 * - This service never logs DIDs or keys in production.
 */

import { getDID, saveDID } from '../Storage/didStorage';
import { generateEthrDID } from './didService';
import { safeLogger } from '../utils/safeLogger';

export type WalletIdentityStatus =
  | 'ready'            // DID exists and is accessible
  | 'creating'         // DID is being generated for the first time
  | 'not_initialized'  // No DID exists yet (onboarding not complete)
  | 'error';           // DID generation or loading failed

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

/**
 * Loads the current wallet identity from persistent storage.
 * Returns null if no identity exists (first launch / not onboarded).
 */
export async function getWalletIdentity(): Promise<WalletIdentity | null> {
  try {
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

/**
 * Ensures a wallet identity exists. If not, generates a new one.
 *
 * This should be called during wallet setup (after PIN creation), NOT on every
 * app launch. Use getWalletIdentity() for read-only access.
 *
 * @throws Error if DID generation fails
 */
export async function ensureWalletIdentity(): Promise<WalletIdentity> {
  const existing = await getWalletIdentity();

  if (existing) {
    return existing;
  }

  safeLogger.info('No wallet identity found, generating new DID');

  const newDIDData = await generateEthrDID();

  await saveDID(newDIDData);

  return {
    ...newDIDData,
    status: 'ready',
  };
}

/**
 * Returns the holder DID string for use in credential subjects and presentations.
 * Returns null if no identity has been created yet.
 */
export async function getHolderDid(): Promise<string | null> {
  const identity = await getWalletIdentity();
  return identity?.did ?? null;
}

/**
 * Returns a display-safe summary of the wallet identity.
 * Safe to use in UI — does NOT expose private keys.
 */
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
  const shortDid = did.length > 32
    ? `${did.slice(0, 14)}...${did.slice(-6)}`
    : did;

  return {
    did,
    shortDid,
    method: identity.method,
    network: identity.network,
    createdAt: identity.createdAt,
    isReady: true,
  };
}

/**
 * Checks if the wallet has a fully initialized identity (DID exists).
 */
export async function hasWalletIdentity(): Promise<boolean> {
  const identity = await getWalletIdentity();
  return identity !== null;
}
