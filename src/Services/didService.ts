import { agent } from '../veramo/agent';
import { safeLogger } from '../utils/safeLogger';

export type DIDData = {
  did: string;
  provider: string;
  alias?: string;
  method: string;
  network: string;
  controllerKeyId?: string;
  createdAt: string;
};

/**
 * Generates a new did:key identifier entirely on-device.
 * No network or blockchain interaction required.
 * The DID is derived from the generated Ed25519 public key.
 */
export const generateEthrDID = async (): Promise<DIDData> => {
  try {
    const identifier = await agent.didManagerCreate({
      provider: 'did:key',
      alias: `user-${Date.now()}`,
      options: { keyType: 'Ed25519' },
    });

    return {
      did: identifier.did,
      provider: identifier.provider,
      alias: identifier.alias,
      method: 'key',
      network: 'none',
      controllerKeyId: identifier.controllerKeyId,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    safeLogger.error(`Failed to create Veramo DID: ${message}`);
    throw error;
  }
};

export const getManagedDIDs = async () => {
  return await agent.didManagerFind();
};