import * as SecureStore from 'expo-secure-store';
import { ModularCredential } from '../types/vc';

const VC_INDEX_KEY = 'USER_VERIFIABLE_CREDENTIAL_INDEX';
const VC_ITEM_PREFIX = 'USER_VERIFIABLE_CREDENTIAL_ITEM_';

async function getVCIds(): Promise<string[]> {
  const data = await SecureStore.getItemAsync(VC_INDEX_KEY);
  return data ? JSON.parse(data) : [];
}

async function saveVCIds(ids: string[]) {
  await SecureStore.setItemAsync(VC_INDEX_KEY, JSON.stringify(ids));
}

function normalizeVC(vc: any): ModularCredential {
  const jwt =
    typeof vc === 'string'
      ? vc
      : vc?.proof?.jwt || vc?.jwt || vc?.verifiableCredential || '';

  if (!jwt) {
    console.log('VC YANG GAGAL DISIMPAN:', vc);
    throw new Error('JWT VC tidak ditemukan');
  }

  if (typeof vc === 'string') {
    return {
      id: `vc-${Date.now()}`,
      type: ['VerifiableCredential'],
      issuer: '-',
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: '-',
        attributeType: 'custom',
        attributeName: 'Imported JWT',
        attributeValue: jwt,
      },
      proof: {
        type: 'JwtProof2020',
        jwt,
        created: new Date().toISOString(),
        proofPurpose: 'assertionMethod',
        verificationMethod: '-',
      },
      jwt,
    };
  }

  return {
    id: vc?.id || `vc-${Date.now()}`,
    type: vc?.type || ['VerifiableCredential'],
    issuer:
      typeof vc?.issuer === 'string'
        ? vc.issuer
        : vc?.issuer?.id || '-',
    issuanceDate: vc?.issuanceDate || new Date().toISOString(),
    expirationDate: vc?.expirationDate,
    credentialSubject: {
      id: vc?.credentialSubject?.id || '-',
      attributeType: vc?.credentialSubject?.attributeType || 'custom',
      attributeName: vc?.credentialSubject?.attributeName || 'Credential',
      attributeValue: vc?.credentialSubject?.attributeValue || '',
    },
    proof: vc?.proof || {
      type: 'JwtProof2020',
      jwt,
      created: vc?.issuanceDate || new Date().toISOString(),
      proofPurpose: 'assertionMethod',
      verificationMethod:
        typeof vc?.issuer === 'string'
          ? vc.issuer
          : vc?.issuer?.id || '-',
    },
    jwt,
  };
}

export const saveVC = async (vc: any): Promise<ModularCredential> => {
  const newVC = normalizeVC(vc);
  const ids = await getVCIds();

  const updatedIds = [newVC.id, ...ids.filter((id) => id !== newVC.id)];

  await SecureStore.setItemAsync(
    `${VC_ITEM_PREFIX}${newVC.id}`,
    JSON.stringify(newVC)
  );

  await saveVCIds(updatedIds);

  return newVC;
};

export const getVCs = async (): Promise<ModularCredential[]> => {
  const ids = await getVCIds();
  const vcs: ModularCredential[] = [];

  for (const id of ids) {
    const data = await SecureStore.getItemAsync(`${VC_ITEM_PREFIX}${id}`);

    if (data) {
      vcs.push(JSON.parse(data));
    }
  }

  return vcs;
};

export const getAllVCs = async (): Promise<ModularCredential[]> => {
  return await getVCs();
};

export const getVCById = async (
  id: string
): Promise<ModularCredential | null> => {
  const data = await SecureStore.getItemAsync(`${VC_ITEM_PREFIX}${id}`);

  if (!data) return null;

  return JSON.parse(data);
};

export const deleteAllVCs = async () => {
  const ids = await getVCIds();

  for (const id of ids) {
    await SecureStore.deleteItemAsync(`${VC_ITEM_PREFIX}${id}`);
  }

  await SecureStore.deleteItemAsync(VC_INDEX_KEY);
};