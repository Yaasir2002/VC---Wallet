import 'react-native-get-random-values';
import '@ethersproject/shims';
import 'react-native-url-polyfill/auto';

import { Buffer } from 'buffer';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { safeLogger } from '../src/utils/safeLogger';
import { isSystemUIOpen } from '../src/utils/systemUIGuard';

if (!global.Buffer) {
  global.Buffer = Buffer;
}

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
  const segmentsRef = useRef(segments);
  const isCheckingRef = useRef(false);

  const checkAuth = useCallback(async () => {
    if (isCheckingRef.current) return;

    try {
      isCheckingRef.current = true;

      const pinExists = await hasPin();
      const onboardingDone = await isOnboardingCompleted();
      const sessionUnlocked = await isSessionUnlocked();
      const profileExists = await hasUserProfile();
      const didExists = await getDID();

      const currentGroup = segmentsRef.current[0];
      const currentRoute = segmentsRef.current[1];

      const isAuthRoute = currentGroup === 'auth';
      const isOnboardingRoute = isAuthRoute && currentRoute === 'onboarding';
      const isCreateAccountRoute =
        isAuthRoute && currentRoute === 'create-account';
      const isCreatePinRoute = isAuthRoute && currentRoute === 'create-pin';
      const isUnlockRoute = isAuthRoute && currentRoute === 'unlock';
      const isBackupMnemonicRoute =
        isAuthRoute && currentRoute === 'backup-mnemonic';
      const isRestoreWalletRoute =
        isAuthRoute && currentRoute === 'restore-wallet';

      if (
        !onboardingDone &&
        !isOnboardingRoute &&
        !isCreateAccountRoute &&
        !isRestoreWalletRoute
      ) {
        router.replace('/auth/onboarding');
        return;
      }

      if (!onboardingDone && isAuthRoute) {
        return;
      }

      if (
        onboardingDone &&
        (!profileExists || !didExists) &&
        !isCreateAccountRoute &&
        !isRestoreWalletRoute
      ) {
        router.replace('/auth/create-account');
        return;
      }

      if (
        onboardingDone &&
        profileExists &&
        didExists &&
        !pinExists &&
        !isCreatePinRoute &&
        !isBackupMnemonicRoute
      ) {
        router.replace('/auth/create-pin');
        return;
      }

      if (
        onboardingDone &&
        profileExists &&
        didExists &&
        pinExists &&
        !sessionUnlocked &&
        !isUnlockRoute &&
        !isBackupMnemonicRoute
      ) {
        router.replace('/auth/unlock');
        return;
      }

      if (
        onboardingDone &&
        profileExists &&
        didExists &&
        pinExists &&
        sessionUnlocked &&
        isAuthRoute &&
        !isBackupMnemonicRoute
      ) {
        router.replace('/(tabs)');
      }
    } catch (error) {
      safeLogger.error('Auth gate check failed', {
        error: error instanceof Error ? error.message : 'unknown',
      });
    } finally {
      isCheckingRef.current = false;
      setChecking(false);
    }
  }, [router]);

  const handleAppStateChange = useCallback(
    async (nextAppState: AppStateStatus) => {
      const previousState = appState.current;
      appState.current = nextAppState;

      const currentGroup = segmentsRef.current[0];
      const isAuthRoute = currentGroup === 'auth';

      if (
        previousState === 'active' &&
        nextAppState.match(/inactive|background/) &&
        !isAuthRoute &&
        !isSystemUIOpen()
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
    },
    [checkAuth]
  );

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  const currentRouteGroup = segments[0];

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRouteGroup]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );

    return () => {
      subscription.remove();
    };
  }, [handleAppStateChange]);

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