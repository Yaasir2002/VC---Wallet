import * as LocalAuthentication from 'expo-local-authentication';

export type WalletAuthResult = {
  success: boolean;
  reason?: string;
};

export async function isWalletBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  return hasHardware && isEnrolled;
}

export async function authenticateWalletAccess(
  reason = 'Autentikasi diperlukan untuk mengakses credential wallet.'
): Promise<WalletAuthResult> {
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

    return {
      success: true,
    };
  } catch {
    return {
      success: false,
      reason: 'Autentikasi wallet gagal.',
    };
  }
}