import * as SecureStore from 'expo-secure-store';
import { safeLogger } from '../utils/safeLogger';

const USER_PROFILE_KEY = 'USER_PROFILE';

const secureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type UserProfile = {
  fullName: string;
  birthDate: string;
  email: string;
  phoneNumber: string;
  address: string;
  profileImageUri?: string;
  /** ISO string set once at account creation. Never changed on update. */
  createdAt: string;
  /** ISO string updated on every saveUserProfile() call. */
  updatedAt?: string;
};

/**
 * Persists the user profile securely.
 * Automatically sets `updatedAt` to the current timestamp on every save.
 * Never overwrites `createdAt`.
 */
export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const profileToSave: UserProfile = {
    ...profile,
    updatedAt: new Date().toISOString(),
  };

  await SecureStore.setItemAsync(
    USER_PROFILE_KEY,
    JSON.stringify(profileToSave),
    secureStoreOptions
  );
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const data = await SecureStore.getItemAsync(USER_PROFILE_KEY);

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data) as UserProfile;
  } catch {
    safeLogger.warn('Failed to parse stored user profile');
    return null;
  }
}

export async function hasUserProfile(): Promise<boolean> {
  const profile = await getUserProfile();
  return !!profile;
}

/**
 * Updates specific fields of the stored profile.
 * Returns the updated profile, or null if no profile exists.
 * Does NOT change `createdAt`.
 */
export async function updateUserProfile(
  patch: Partial<Omit<UserProfile, 'createdAt'>>
): Promise<UserProfile | null> {
  const existing = await getUserProfile();

  if (!existing) {
    return null;
  }

  const updated: UserProfile = {
    ...existing,
    ...patch,
    createdAt: existing.createdAt, // never overwrite
  };

  await saveUserProfile(updated);

  return updated;
}

export async function deleteUserProfile(): Promise<void> {
  await SecureStore.deleteItemAsync(USER_PROFILE_KEY);
}