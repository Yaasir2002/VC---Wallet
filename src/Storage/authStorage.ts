import * as SecureStore from 'expo-secure-store';

const PIN_KEY = 'USER_PIN';

export async function savePin(pin: string) {
  await SecureStore.setItemAsync(PIN_KEY, pin);
}

export async function getPin(): Promise<string | null> {
  return await SecureStore.getItemAsync(PIN_KEY);
}

export async function hasPin(): Promise<boolean> {
  const pin = await getPin();
  return !!pin;
}

export async function deletePin() {
  await SecureStore.deleteItemAsync(PIN_KEY);
}