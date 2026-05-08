import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const PIN_KEY = 'USER_PIN_HASH';
const LEGACY_PIN_KEY = 'USER_PIN';
const PIN_SALT_KEY = 'USER_PIN_SALT';
const ONBOARDING_KEY = 'ONBOARDING_COMPLETED';
const BIOMETRIC_KEY = 'BIOMETRIC_ENABLED';

const SESSION_UNLOCKED_KEY = 'SESSION_UNLOCKED';
const SESSION_UNLOCKED_AT_KEY = 'SESSION_UNLOCKED_AT';

const PIN_FAILED_ATTEMPTS_KEY = 'PIN_FAILED_ATTEMPTS';
const PIN_LOCK_UNTIL_KEY = 'PIN_LOCK_UNTIL';

const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCK_DURATION_MS = 5 * 60 * 1000;

const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

const secureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type PinLockStatus = {
  isLocked: boolean;
  failedAttempts: number;
  remainingAttempts: number;
  lockUntil: number | null;
  remainingLockTimeMs: number;
};

export type SessionStatus = {
  isUnlocked: boolean;
  unlockedAt: number | null;
  remainingSessionTimeMs: number;
};

async function getOrCreatePinSalt() {
  const existingSalt = await SecureStore.getItemAsync(PIN_SALT_KEY);

  if (existingSalt) {
    return existingSalt;
  }

  const randomBytes = await Crypto.getRandomBytesAsync(16);
  const salt = Array.from(randomBytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  await SecureStore.setItemAsync(PIN_SALT_KEY, salt, secureStoreOptions);

  return salt;
}

async function hashPin(pin: string) {
  const salt = await getOrCreatePinSalt();

  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${pin}`
  );
}

async function getFailedAttempts(): Promise<number> {
  const value = await SecureStore.getItemAsync(PIN_FAILED_ATTEMPTS_KEY);
  const attempts = Number(value);

  if (!Number.isFinite(attempts) || attempts < 0) {
    return 0;
  }

  return attempts;
}

async function setFailedAttempts(value: number) {
  await SecureStore.setItemAsync(
    PIN_FAILED_ATTEMPTS_KEY,
    String(value),
    secureStoreOptions
  );
}

async function getLockUntil(): Promise<number | null> {
  const value = await SecureStore.getItemAsync(PIN_LOCK_UNTIL_KEY);

  if (!value) {
    return null;
  }

  const lockUntil = Number(value);

  if (!Number.isFinite(lockUntil)) {
    await SecureStore.deleteItemAsync(PIN_LOCK_UNTIL_KEY);
    return null;
  }

  return lockUntil;
}

async function setLockUntil(value: number) {
  await SecureStore.setItemAsync(
    PIN_LOCK_UNTIL_KEY,
    String(value),
    secureStoreOptions
  );
}

async function clearPinLockout() {
  await SecureStore.deleteItemAsync(PIN_FAILED_ATTEMPTS_KEY);
  await SecureStore.deleteItemAsync(PIN_LOCK_UNTIL_KEY);
}

async function registerFailedPinAttempt() {
  const currentAttempts = await getFailedAttempts();
  const nextAttempts = currentAttempts + 1;

  await setFailedAttempts(nextAttempts);

  if (nextAttempts >= MAX_PIN_ATTEMPTS) {
    await setLockUntil(Date.now() + PIN_LOCK_DURATION_MS);
  }
}

async function getSessionUnlockedAt(): Promise<number | null> {
  const value = await SecureStore.getItemAsync(SESSION_UNLOCKED_AT_KEY);

  if (!value) {
    return null;
  }

  const unlockedAt = Number(value);

  if (!Number.isFinite(unlockedAt)) {
    await SecureStore.deleteItemAsync(SESSION_UNLOCKED_AT_KEY);
    return null;
  }

  return unlockedAt;
}

async function setSessionUnlockedAt(value: number) {
  await SecureStore.setItemAsync(
    SESSION_UNLOCKED_AT_KEY,
    String(value),
    secureStoreOptions
  );
}

export async function getPinLockStatus(): Promise<PinLockStatus> {
  const failedAttempts = await getFailedAttempts();
  const lockUntil = await getLockUntil();
  const now = Date.now();

  if (lockUntil && lockUntil > now) {
    return {
      isLocked: true,
      failedAttempts,
      remainingAttempts: 0,
      lockUntil,
      remainingLockTimeMs: lockUntil - now,
    };
  }

  if (lockUntil && lockUntil <= now) {
    await clearPinLockout();

    return {
      isLocked: false,
      failedAttempts: 0,
      remainingAttempts: MAX_PIN_ATTEMPTS,
      lockUntil: null,
      remainingLockTimeMs: 0,
    };
  }

  return {
    isLocked: false,
    failedAttempts,
    remainingAttempts: Math.max(MAX_PIN_ATTEMPTS - failedAttempts, 0),
    lockUntil: null,
    remainingLockTimeMs: 0,
  };
}

export async function savePin(pin: string) {
  const hashedPin = await hashPin(pin);

  await SecureStore.setItemAsync(PIN_KEY, hashedPin, secureStoreOptions);

  await SecureStore.deleteItemAsync(LEGACY_PIN_KEY);
  await clearPinLockout();
}

export async function getPin(): Promise<string | null> {
  return await SecureStore.getItemAsync(PIN_KEY);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const lockStatus = await getPinLockStatus();

  if (lockStatus.isLocked) {
    return false;
  }

  const savedPinHash = await SecureStore.getItemAsync(PIN_KEY);

  if (!savedPinHash) {
    const legacyPin = await SecureStore.getItemAsync(LEGACY_PIN_KEY);
    const isValidLegacyPin = legacyPin === pin;

    if (isValidLegacyPin) {
      await clearPinLockout();
      return true;
    }

    await registerFailedPinAttempt();
    return false;
  }

  const inputHash = await hashPin(pin);
  const isValidPin = inputHash === savedPinHash;

  if (isValidPin) {
    await clearPinLockout();
    return true;
  }

  await registerFailedPinAttempt();
  return false;
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
  await clearPinLockout();
  await lockSession();
}

export async function setOnboardingCompleted(value: boolean) {
  await SecureStore.setItemAsync(
    ONBOARDING_KEY,
    value ? 'true' : 'false',
    secureStoreOptions
  );
}

export async function isOnboardingCompleted(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(ONBOARDING_KEY);
  return value === 'true';
}

export async function setBiometricEnabled(value: boolean) {
  await SecureStore.setItemAsync(
    BIOMETRIC_KEY,
    value ? 'true' : 'false',
    secureStoreOptions
  );
}

export async function isBiometricEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(BIOMETRIC_KEY);
  return value === 'true';
}

export async function setSessionUnlocked(value: boolean) {
  await SecureStore.setItemAsync(
    SESSION_UNLOCKED_KEY,
    value ? 'true' : 'false',
    secureStoreOptions
  );

  if (value) {
    await setSessionUnlockedAt(Date.now());
    return;
  }

  await SecureStore.deleteItemAsync(SESSION_UNLOCKED_AT_KEY);
}

export async function refreshSession() {
  const sessionUnlocked = await isSessionUnlocked();

  if (!sessionUnlocked) {
    return;
  }

  await setSessionUnlockedAt(Date.now());
}

export async function getSessionStatus(): Promise<SessionStatus> {
  const value = await SecureStore.getItemAsync(SESSION_UNLOCKED_KEY);

  if (value !== 'true') {
    return {
      isUnlocked: false,
      unlockedAt: null,
      remainingSessionTimeMs: 0,
    };
  }

  const unlockedAt = await getSessionUnlockedAt();

  if (!unlockedAt) {
    await lockSession();

    return {
      isUnlocked: false,
      unlockedAt: null,
      remainingSessionTimeMs: 0,
    };
  }

  const remainingSessionTimeMs =
    SESSION_TIMEOUT_MS - (Date.now() - unlockedAt);

  if (remainingSessionTimeMs <= 0) {
    await lockSession();

    return {
      isUnlocked: false,
      unlockedAt: null,
      remainingSessionTimeMs: 0,
    };
  }

  return {
    isUnlocked: true,
    unlockedAt,
    remainingSessionTimeMs,
  };
}

export async function getSessionRemainingTime(): Promise<number> {
  const sessionStatus = await getSessionStatus();
  return sessionStatus.remainingSessionTimeMs;
}

export async function isSessionUnlocked(): Promise<boolean> {
  const sessionStatus = await getSessionStatus();
  return sessionStatus.isUnlocked;
}

export async function lockSession() {
  await SecureStore.setItemAsync(
    SESSION_UNLOCKED_KEY,
    'false',
    secureStoreOptions
  );

  await SecureStore.deleteItemAsync(SESSION_UNLOCKED_AT_KEY);
}

export async function resetAuth() {
  await SecureStore.deleteItemAsync(PIN_KEY);
  await SecureStore.deleteItemAsync(LEGACY_PIN_KEY);
  await SecureStore.deleteItemAsync(PIN_SALT_KEY);
  await SecureStore.deleteItemAsync(ONBOARDING_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
  await SecureStore.deleteItemAsync(SESSION_UNLOCKED_KEY);
  await SecureStore.deleteItemAsync(SESSION_UNLOCKED_AT_KEY);
  await clearPinLockout();
}