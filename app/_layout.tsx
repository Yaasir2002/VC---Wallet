import 'react-native-get-random-values';
import '@ethersproject/shims';
import 'react-native-url-polyfill/auto';

import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import {
  hasPin,
  isOnboardingCompleted,
  isSessionUnlocked,
} from '../src/Storage/authStorage';
import { hasUserProfile } from '../src/Storage/profileStorage';
import { getDID } from '../src/Storage/didStorage';

export default function RootLayout() {
  return (
    <>
      <AuthGate />
      <Slot />
    </>
  );
}

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();

  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkAuth();
  }, [segments]);

  async function checkAuth() {
    const pinExists = await hasPin();
    const onboardingDone = await isOnboardingCompleted();
    const sessionUnlocked = await isSessionUnlocked();
    const profileExists = await hasUserProfile();
    const didExists = await getDID();

    const currentGroup = segments[0];
    const currentRoute = segments[1];

    const isAuthRoute = currentGroup === 'auth';
    const isOnboardingRoute = isAuthRoute && currentRoute === 'onboarding';
    const isCreateAccountRoute = isAuthRoute && currentRoute === 'create-account';

    if (!onboardingDone && !isOnboardingRoute && !isCreateAccountRoute) {
      router.replace('/auth/onboarding');
      setChecking(false);
      return;
    }

    if (!onboardingDone && isAuthRoute) {
      setChecking(false);
      return;
    }

    if (onboardingDone && (!profileExists || !didExists) && !isCreateAccountRoute) {
      router.replace('/auth/create-account');
      setChecking(false);
      return;
    }

    if (onboardingDone && profileExists && didExists && !pinExists && !isAuthRoute) {
      router.replace('/auth/create-pin');
      setChecking(false);
      return;
    }

    if (
      onboardingDone &&
      profileExists &&
      didExists &&
      pinExists &&
      !sessionUnlocked &&
      !isAuthRoute
    ) {
      router.replace('/auth/unlock');
      setChecking(false);
      return;
    }

    if (
      onboardingDone &&
      profileExists &&
      didExists &&
      pinExists &&
      sessionUnlocked &&
      isAuthRoute
    ) {
      router.replace('/(tabs)');
      setChecking(false);
      return;
    }

    setChecking(false);
  }

  if (checking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
});