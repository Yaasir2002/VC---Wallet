import AsyncStorage from '@react-native-async-storage/async-storage';
import { ModularCredential } from '../types/vc';

const VC_KEY = 'USER_VERIFIABLE_CREDENTIALS';

export const saveVC = async (vc: ModularCredential) => {
  const oldData = await AsyncStorage.getItem(VC_KEY);
  const oldVCs: ModularCredential[] = oldData ? JSON.parse(oldData) : [];

  const updatedVCs = [vc, ...oldVCs];

  await AsyncStorage.setItem(VC_KEY, JSON.stringify(updatedVCs));

  return vc;
};

export const getVCs = async (): Promise<ModularCredential[]> => {
  const data = await AsyncStorage.getItem(VC_KEY);
  return data ? JSON.parse(data) : [];
};

export const getAllVCs = async (): Promise<ModularCredential[]> => {
  return await getVCs();
};

export const getVCById = async (id: string) => {
  const vcs = await getVCs();
  return vcs.find((vc) => vc.id === id) || null;
};

export const deleteAllVCs = async () => {
  await AsyncStorage.removeItem(VC_KEY);
};