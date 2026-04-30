import 'react-native-get-random-values';
import '@ethersproject/shims';
import 'react-native-url-polyfill/auto';

import { useEffect, useRef, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  AppState,
  AppStateStatus,
} from 'react-native';
import {
  hasPin,
  isOnboardingCompleted,
  isSessionUnlocked,
  lockSession,
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
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    checkAuth();
  }, [segments]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );

    return () => {
      subscription.remove();
    };
  }, [segments]);

  async function handleAppStateChange(nextAppState: AppStateStatus) {
    const previousState = appState.current;
    appState.current = nextAppState;

    const currentGroup = segments[0];
    const isAuthRoute = currentGroup === 'auth';

    if (
      previousState === 'active' &&
      (nextAppState === 'background' || nextAppState === 'inactive') &&
      !isAuthRoute
    ) {
      await lockSession();
      return;
    }

    if (
      previousState.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      await checkAuth();
    }
  }

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
    const isCreateAccountRoute =
      isAuthRoute && currentRoute === 'create-account';
    const isCreatePinRoute = isAuthRoute && currentRoute === 'create-pin';
    const isUnlockRoute = isAuthRoute && currentRoute === 'unlock';

    if (!onboardingDone && !isOnboardingRoute && !isCreateAccountRoute) {
      router.replace('/auth/onboarding');
      setChecking(false);
      return;
    }

    if (!onboardingDone && isAuthRoute) {
      setChecking(false);
      return;
    }

    if (
      onboardingDone &&
      (!profileExists || !didExists) &&
      !isCreateAccountRoute
    ) {
      router.replace('/auth/create-account');
      setChecking(false);
      return;
    }

    if (
      onboardingDone &&
      profileExists &&
      didExists &&
      !pinExists &&
      !isCreatePinRoute
    ) {
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
      !isUnlockRoute
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