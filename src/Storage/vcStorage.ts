import { VerifiableCredential } from '../types/vc';
import {
  saveSecureData,
  getSecureData,
  deleteSecureData,
} from './secureStorage';

const VC_STORAGE_KEY = 'USER_VERIFIABLE_CREDENTIALS';

export async function saveVC(vc: VerifiableCredential): Promise<void> {
  const currentVCs = await getAllVCs();
  const updatedVCs = [...currentVCs, vc];

  await saveSecureData(VC_STORAGE_KEY, JSON.stringify(updatedVCs));
}

export async function getAllVCs(): Promise<VerifiableCredential[]> {
  const data = await getSecureData(VC_STORAGE_KEY);

  if (!data) {
    return [];
  }

  return JSON.parse(data) as VerifiableCredential[];
}

export async function getVCById(
  id: string
): Promise<VerifiableCredential | null> {
  const vcs = await getAllVCs();

  const selectedVC = vcs.find((vc) => vc.id === id);

  return selectedVC ?? null;
}

export async function deleteAllVCs(): Promise<void> {
  await deleteSecureData(VC_STORAGE_KEY);
}