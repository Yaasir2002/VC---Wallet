import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { createWalletWithMnemonic } from '../../src/Services/recoverableWalletIdentityService';
import { setOnboardingCompleted } from '../../src/Storage/authStorage';
import { saveUserProfile } from '../../src/Storage/profileStorage';
import { safeLogger } from '../../src/utils/safeLogger';

export default function OnboardingScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    try {
      setLoading(true);

      await createWalletWithMnemonic();

      await saveUserProfile({
        fullName: 'Wallet User',
        birthDate: new Date().toISOString(),
        email: 'wallet.user@local',
        phoneNumber: '080000000000',
        address: 'Local Wallet Profile',
        profileImageUri: undefined,
        createdAt: new Date().toISOString(),
      });

      await setOnboardingCompleted(true);

      router.replace('/auth/backup-mnemonic');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      safeLogger.error(`Failed to initialize wallet from onboarding: ${message}`);

      Alert.alert(
        'Gagal Membuat Wallet',
        'Wallet baru gagal dibuat. Silakan coba lagi.'
      );
    } finally {
      setLoading(false);
    }
  }

  function handleRestoreWallet() {
    router.push('/auth/restore-wallet');
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2563EB', '#1D4ED8', '#F97316']}
        style={styles.hero}
      >
        <View style={styles.topRow}>
          <Text style={styles.brand}>SSI Wallet</Text>
        </View>

        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark-outline" size={58} color="#2563EB" />
        </View>

        <Text style={styles.title}>Kelola Identitas Digitalmu</Text>

        <Text style={styles.subtitle}>
          Buat DID, simpan recovery phrase, dan kelola Verifiable Credential
          secara aman langsung dari perangkatmu.
        </Text>
      </LinearGradient>

      <View style={styles.bottomCard}>
        <Text style={styles.infoTitle}>Mulai dengan Wallet Baru</Text>

        <Text style={styles.infoText}>
          Saat tombol mulai ditekan, aplikasi akan otomatis membuat DID dan
          recovery phrase 12 kata. Setelah itu, kamu akan diminta menyimpan
          recovery phrase dan membuat PIN wallet.
        </Text>

        <Pressable
          style={[styles.primaryButton, loading && styles.disabledButton]}
          onPress={handleStart}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="wallet-outline" size={20} color="#FFFFFF" />
          )}

          <Text style={styles.primaryButtonText}>
            {loading ? 'Membuat Wallet...' : 'Buat Wallet Baru'}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.restoreButton, loading && styles.disabledRestoreButton]}
          onPress={handleRestoreWallet}
          disabled={loading}
        >
          <Ionicons name="refresh-outline" size={20} color="#2563EB" />
          <Text style={styles.restoreButtonText}>Restore Wallet</Text>
        </Pressable>
      </View>
    </View>
  );
}

const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  hero: {
    minHeight: height * 0.68,
    padding: 24,
    paddingTop: 54,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    alignItems: 'center',
  },
  topRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  iconCircle: {
    width: 122,
    height: 122,
    borderRadius: 61,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 92,
    marginBottom: 28,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 38,
  },
  subtitle: {
    color: '#DBEAFE',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 320,
  },
  bottomCard: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    marginTop: -38,
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 21,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 18,
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  disabledButton: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  restoreButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 18,
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  disabledRestoreButton: {
    opacity: 0.6,
  },
  restoreButtonText: {
    color: '#2563EB',
    fontWeight: '900',
    fontSize: 15,
  },
});