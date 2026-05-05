import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const PIN_KEY = 'USER_PIN_HASH';
const LEGACY_PIN_KEY = 'USER_PIN';
const PIN_SALT_KEY = 'USER_PIN_SALT';
const ONBOARDING_KEY = 'ONBOARDING_COMPLETED';
const BIOMETRIC_KEY = 'BIOMETRIC_ENABLED';
const SESSION_UNLOCKED_KEY = 'SESSION_UNLOCKED';

async function getOrCreatePinSalt() {
  const existingSalt = await SecureStore.getItemAsync(PIN_SALT_KEY);

  if (existingSalt) {
    return existingSalt;
  }

  const randomBytes = await Crypto.getRandomBytesAsync(16);
  const salt = Array.from(randomBytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  await SecureStore.setItemAsync(PIN_SALT_KEY, salt, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  return salt;
}

async function hashPin(pin: string) {
  const salt = await getOrCreatePinSalt();

  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${pin}`
  );
}

export async function savePin(pin: string) {
  const hashedPin = await hashPin(pin);

  await SecureStore.setItemAsync(PIN_KEY, hashedPin, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  await SecureStore.deleteItemAsync(LEGACY_PIN_KEY);
}

export async function getPin(): Promise<string | null> {
  return await SecureStore.getItemAsync(PIN_KEY);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const savedPinHash = await SecureStore.getItemAsync(PIN_KEY);

  if (!savedPinHash) {
    const legacyPin = await SecureStore.getItemAsync(LEGACY_PIN_KEY);
    return legacyPin === pin;
  }

  const inputHash = await hashPin(pin);
  return inputHash === savedPinHash;
}

export async function hasPin(): Promise<boolean> {
  const pinHash = await SecureStore.getItemAsync(PIN_KEY);
  const legacyPin = await SecureStore.getItemAsync(LEGACY_PIN_KEY);

  return !!pinHash || !!legacyPin;
}

export async function deletePin() {
  await SecureStore.deleteItemAsync(PIN_KEY);
  await SecureStore.deleteItemAsync(LEGACY_PIN_KEY);
  await SecureStore.deleteItemAsync(PIN_SALT_KEY);
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
  await SecureStore.deleteItemAsync(LEGACY_PIN_KEY);
  await SecureStore.deleteItemAsync(PIN_SALT_KEY);
  await SecureStore.deleteItemAsync(ONBOARDING_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
  await SecureStore.deleteItemAsync(SESSION_UNLOCKED_KEY);
}