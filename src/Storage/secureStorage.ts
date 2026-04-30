import * as SecureStore from 'expo-secure-store';

const VC_KEY = 'USER_VERIFIABLE_CREDENTIALS';

export const saveVC = async (vc: any) => {
  const oldData = await SecureStore.getItemAsync(VC_KEY);
  const oldVCs = oldData ? JSON.parse(oldData) : [];

  const jwt =
    typeof vc === 'string'
      ? vc
      : vc?.proof?.jwt || vc?.jwt || vc?.verifiableCredential || '';

  if (!jwt) {
    console.log('VC YANG GAGAL DISIMPAN:', vc);
    throw new Error('JWT VC tidak ditemukan dari hasil Veramo');
  }

  const newVC = {
    ...vc,
    id: vc?.id || Date.now().toString(),
    jwt,
    createdAt: vc?.createdAt || new Date().toISOString(),
  };

  const updatedVCs = [newVC, ...oldVCs];

  await SecureStore.setItemAsync(VC_KEY, JSON.stringify(updatedVCs));

  return newVC;
};

export const getVCs = async () => {
  const data = await SecureStore.getItemAsync(VC_KEY);
  return data ? JSON.parse(data) : [];
};

export const getAllVCs = async () => {
  return await getVCs();
};

export const getVCById = async (id: string) => {
  const vcs = await getVCs();
  return vcs.find((vc: any) => vc.id === id) || null;
};

export const deleteAllVCs = async () => {
  await SecureStore.deleteItemAsync(VC_KEY);
};