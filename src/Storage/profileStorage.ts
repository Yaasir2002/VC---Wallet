import * as SecureStore from 'expo-secure-store';

const USER_PROFILE_KEY = 'USER_PROFILE';

export type UserProfile = {
  fullName: string;
  birthDate: string;
  email: string;
  phoneNumber: string;
  address: string;
  createdAt: string;
};

export async function saveUserProfile(profile: UserProfile) {
  await SecureStore.setItemAsync(USER_PROFILE_KEY, JSON.stringify(profile));
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const data = await SecureStore.getItemAsync(USER_PROFILE_KEY);

  if (!data) return null;

  return JSON.parse(data);
}

export async function hasUserProfile(): Promise<boolean> {
  const profile = await getUserProfile();
  return !!profile;
}

export async function deleteUserProfile() {
  await SecureStore.deleteItemAsync(USER_PROFILE_KEY);
}