import * as SecureStore from 'expo-secure-store';
import { DIDData } from '../Services/didService';

const DID_KEY = 'USER_VERAMO_DID';

export const saveDID = async (didData: DIDData) => {
  await SecureStore.setItemAsync(DID_KEY, JSON.stringify(didData));
};

export const getDID = async (): Promise<DIDData | null> => {
  const data = await SecureStore.getItemAsync(DID_KEY);

  if (!data) return null;

  return JSON.parse(data);
};

export const deleteDID = async () => {
  await SecureStore.deleteItemAsync(DID_KEY);
};