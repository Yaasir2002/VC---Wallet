import * as SecureStore from 'expo-secure-store';

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
  createdAt: string;
};

export async function saveUserProfile(profile: UserProfile) {
  await SecureStore.setItemAsync(
    USER_PROFILE_KEY,
    JSON.stringify(profile),
    secureStoreOptions
  );
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const data = await SecureStore.getItemAsync(USER_PROFILE_KEY);

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data);
  } catch {
    console.log('PARSE USER PROFILE ERROR');
    return null;
  }
}

export async function hasUserProfile(): Promise<boolean> {
  const profile = await getUserProfile();
  return !!profile;
}

export async function deleteUserProfile() {
  await SecureStore.deleteItemAsync(USER_PROFILE_KEY);
}