import * as SecureStore from 'expo-secure-store';

export async function saveSecureData(
  key: string,
  value: string
): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    console.error('Gagal menyimpan data secure:', error);
    throw error;
  }
}

export async function getSecureData(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.error('Gagal mengambil data secure:', error);
    throw error;
  }
}

export async function deleteSecureData(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.error('Gagal menghapus data secure:', error);
    throw error;
  }
}