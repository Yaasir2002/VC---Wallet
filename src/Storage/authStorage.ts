import * as SecureStore from 'expo-secure-store';

const PIN_KEY = 'USER_PIN';
const ONBOARDING_KEY = 'ONBOARDING_COMPLETED';
const BIOMETRIC_KEY = 'BIOMETRIC_ENABLED';
const SESSION_UNLOCKED_KEY = 'SESSION_UNLOCKED';

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

export async function setOnboardingCompleted(value: boolean) {
  await SecureStore.setItemAsync(ONBOARDING_KEY, value ? 'true' : 'false');
}

export async function isOnboardingCompleted(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(ONBOARDING_KEY);
  return value === 'true';
}

export async function setBiometricEnabled(value: boolean) {
  await SecureStore.setItemAsync(BIOMETRIC_KEY, value ? 'true' : 'false');
}

export async function isBiometricEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(BIOMETRIC_KEY);
  return value === 'true';
}

export async function setSessionUnlocked(value: boolean) {
  await SecureStore.setItemAsync(
    SESSION_UNLOCKED_KEY,
    value ? 'true' : 'false'
  );
}

export async function isSessionUnlocked(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(SESSION_UNLOCKED_KEY);
  return value === 'true';
}

export async function lockSession() {
  await SecureStore.setItemAsync(SESSION_UNLOCKED_KEY, 'false');
}

export async function resetAuth() {
  await SecureStore.deleteItemAsync(PIN_KEY);
  await SecureStore.deleteItemAsync(ONBOARDING_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
  await SecureStore.deleteItemAsync(SESSION_UNLOCKED_KEY);
}