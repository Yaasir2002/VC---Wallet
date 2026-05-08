import AsyncStorage from '@react-native-async-storage/async-storage';
import { ModularCredential } from '../types/vc';

const VC_INDEX_KEY = 'USER_VERIFIABLE_CREDENTIAL_INDEX';
const VC_ITEM_PREFIX = 'USER_VERIFIABLE_CREDENTIAL_ITEM_';

async function getVCIds(): Promise<string[]> {
  const data = await AsyncStorage.getItem(VC_INDEX_KEY);

  if (!data) {
    return [];
  }

  try {
    const parsed = JSON.parse(data);

    if (Array.isArray(parsed)) {
      return parsed.filter((id) => typeof id === 'string' && id.trim());
    }

    return [];
  } catch {
    console.log('PARSE VC IDS ERROR');
    return [];
  }
}

async function saveVCIds(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids));
  await AsyncStorage.setItem(VC_INDEX_KEY, JSON.stringify(uniqueIds));
}

function normalizeVC(vc: any): ModularCredential {
  const jwt =
    typeof vc === 'string'
      ? vc
      : vc?.proof?.jwt || vc?.jwt || vc?.verifiableCredential || '';

  if (!jwt) {
    throw new Error('JWT VC tidak ditemukan');
  }

  if (typeof vc === 'string') {
    return {
      id: `vc-${Date.now()}`,
      documentId: `LEGACY-${Date.now()}`,
      documentType: 'CUSTOM',
      documentName: 'Imported Credential',
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
    documentId: vc?.documentId || `LEGACY-${vc?.id || Date.now()}`,
    documentType: vc?.documentType || 'CUSTOM',
    documentName: vc?.documentName || 'Credential Document',
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

  await AsyncStorage.setItem(
    `${VC_ITEM_PREFIX}${newVC.id}`,
    JSON.stringify(newVC)
  );

  await saveVCIds(updatedIds);

  return newVC;
};

export const getVCs = async (): Promise<ModularCredential[]> => {
  const ids = await getVCIds();
  const vcs: ModularCredential[] = [];
  const validIds: string[] = [];

  for (const id of ids) {
    const data = await AsyncStorage.getItem(`${VC_ITEM_PREFIX}${id}`);

    if (!data) {
      continue;
    }

    try {
      const parsed = JSON.parse(data);
      vcs.push(parsed);
      validIds.push(id);
    } catch {
      console.log('PARSE VC ITEM ERROR');
    }
  }

  if (validIds.length !== ids.length) {
    await saveVCIds(validIds);
  }

  return vcs;
};

export const getAllVCs = async (): Promise<ModularCredential[]> => {
  return await getVCs();
};

export const getVCById = async (
  id: string
): Promise<ModularCredential | null> => {
  if (!id?.trim()) {
    return null;
  }

  const data = await AsyncStorage.getItem(`${VC_ITEM_PREFIX}${id}`);

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data);
  } catch {
    console.log('PARSE VC BY ID ERROR');
    return null;
  }
};

export const deleteVCById = async (id: string): Promise<boolean> => {
  if (!id?.trim()) {
    throw new Error('ID credential tidak valid');
  }

  const ids = await getVCIds();

  if (!ids.includes(id)) {
    throw new Error('Credential tidak ditemukan');
  }

  await AsyncStorage.removeItem(`${VC_ITEM_PREFIX}${id}`);
  await saveVCIds(ids.filter((itemId) => itemId !== id));

  return true;
};

export const deleteVCsByDocumentId = async (
  documentId: string
): Promise<number> => {
  if (!documentId?.trim()) {
    throw new Error('ID dokumen credential tidak valid');
  }

  const ids = await getVCIds();
  const credentials = await getVCs();

  const targetCredentials = credentials.filter(
    (credential) => credential.documentId === documentId
  );

  if (targetCredentials.length === 0) {
    throw new Error('Dokumen credential tidak ditemukan');
  }

  const targetIds = targetCredentials.map((credential) => credential.id);

  for (const id of targetIds) {
    await AsyncStorage.removeItem(`${VC_ITEM_PREFIX}${id}`);
  }

  const updatedIds = ids.filter((id) => !targetIds.includes(id));
  await saveVCIds(updatedIds);

  return targetIds.length;
};

export const deleteAllVCs = async () => {
  const ids = await getVCIds();

  for (const id of ids) {
    await AsyncStorage.removeItem(`${VC_ITEM_PREFIX}${id}`);
  }

  await AsyncStorage.removeItem(VC_INDEX_KEY);
};