import * as SecureStore from 'expo-secure-store';
import { ModularCredential } from '../types/vc';

const VC_KEY = 'USER_VERIFIABLE_CREDENTIALS';

function normalizeVC(vc: any): ModularCredential {
  const jwt =
    typeof vc === 'string'
      ? vc
      : vc?.proof?.jwt || vc?.jwt || vc?.verifiableCredential || '';

  if (!jwt) {
    console.log('VC YANG GAGAL DISIMPAN:', vc);
    throw new Error('JWT VC tidak ditemukan dari hasil Veramo');
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
  const oldData = await SecureStore.getItemAsync(VC_KEY);
  const oldVCs: ModularCredential[] = oldData ? JSON.parse(oldData) : [];

  const newVC = normalizeVC(vc);

  const updatedVCs = [newVC, ...oldVCs];

  await SecureStore.setItemAsync(VC_KEY, JSON.stringify(updatedVCs));

  return newVC;
};

export const getVCs = async (): Promise<ModularCredential[]> => {
  const data = await SecureStore.getItemAsync(VC_KEY);
  return data ? JSON.parse(data) : [];
};

export const getAllVCs = async (): Promise<ModularCredential[]> => {
  return await getVCs();
};

export const getVCById = async (
  id: string
): Promise<ModularCredential | null> => {
  const vcs = await getVCs();
  return vcs.find((vc) => vc.id === id) || null;
};

export const deleteAllVCs = async () => {
  await SecureStore.deleteItemAsync(VC_KEY);
};