import { DIDData } from '../types/did';
import {
  saveSecureData,
  getSecureData,
  deleteSecureData,
} from './secureStorage';

const DID_STORAGE_KEY = 'USER_DID';

export async function saveDID(data: DIDData): Promise<void> {
  await saveSecureData(DID_STORAGE_KEY, JSON.stringify(data));
}

export async function getDID(): Promise<DIDData | null> {
  const data = await getSecureData(DID_STORAGE_KEY);

  if (!data) {
    return null;
  }

  return JSON.parse(data) as DIDData;
}

export async function deleteDID(): Promise<void> {
  await deleteSecureData(DID_STORAGE_KEY);
}