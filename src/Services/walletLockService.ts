import * as LocalAuthentication from 'expo-local-authentication';
import { markSystemUIOpen, markSystemUIClosed } from '../utils/systemUIGuard';
import { refreshSession } from '../Storage/authStorage';

export type WalletAuthResult = {
  success: boolean;
  reason?: string;
};

export async function isWalletBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  return hasHardware && isEnrolled;
}

/**
 * Authenticates the user with biometric/device PIN for accessing sensitive
 * wallet operations (e.g. deleting credential, viewing QR presentation).
 *
 * Wraps the biometric prompt with systemUIGuard so that the AppState change
 * handler does not lock the session when the biometric overlay causes the
 * app to temporarily go to the background on Android.
 */
export async function authenticateWalletAccess(
  reason = 'Autentikasi diperlukan untuk mengakses credential wallet.'
): Promise<WalletAuthResult> {
  markSystemUIOpen();

  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      return {
        success: false,
        reason:
          'Biometric/PIN perangkat belum tersedia. Aktifkan keamanan layar pada perangkat.',
      };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Buka Credential Wallet',
      cancelLabel: 'Batal',
      disableDeviceFallback: false,
      fallbackLabel: 'Gunakan PIN Perangkat',
    });

    if (!result.success) {
      return {
        success: false,
        reason,
      };
    }

    // Refresh session after successful auth so the timer resets
    await refreshSession();

    return {
      success: true,
    };
  } catch {
    return {
      success: false,
      reason: 'Autentikasi wallet gagal.',
    };
  } finally {
    // Always release the guard, even if auth fails or throws
    markSystemUIClosed();
  }
}