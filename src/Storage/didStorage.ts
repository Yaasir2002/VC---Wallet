import * as SecureStore from 'expo-secure-store';
import { DIDData } from '../Services/didService';

const DID_KEY = 'USER_VERAMO_DID';

const secureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const saveDID = async (didData: DIDData) => {
  await SecureStore.setItemAsync(
    DID_KEY,
    JSON.stringify(didData),
    secureStoreOptions
  );
};

export const getDID = async (): Promise<DIDData | null> => {
  const data = await SecureStore.getItemAsync(DID_KEY);

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data);
  } catch {
    console.log('PARSE DID DATA ERROR');
    return null;
  }
};

export const deleteDID = async () => {
  await SecureStore.deleteItemAsync(DID_KEY);
};