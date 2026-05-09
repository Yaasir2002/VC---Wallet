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

export const generateEthrDID = async (): Promise<DIDData> => {
  try {
    const identifier = await agent.didManagerCreate({
      provider: 'did:ethr:sepolia',
      alias: `user-${Date.now()}`,
    });

    return {
      did: identifier.did,
      provider: identifier.provider,
      alias: identifier.alias,
      method: 'ethr',
      network: 'sepolia',
      controllerKeyId: identifier.controllerKeyId,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    safeLogger.error('Failed to create Veramo DID');
    throw error;
  }
};

export const getManagedDIDs = async () => {
  return await agent.didManagerFind();
};