import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { restoreWalletFromMnemonic } from '../../src/Services/recoverableWalletIdentityService';
import { validateMnemonic12Words } from '../../src/Services/mnemonicService';
import { setOnboardingCompleted } from '../../src/Storage/authStorage';
import AppToast from '../../components/ui/AppToast';

export default function RestoreWalletScreen() {
  const router = useRouter();

  const [mnemonic, setMnemonic] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'info',
  });

  async function handleRestore() {
    const validation = validateMnemonic12Words(mnemonic);

    if (!validation.valid) {
      setToast({
        visible: true,
        message: validation.error ?? 'Recovery phrase tidak valid.',
        type: 'error',
      });
      return;
    }

    try {
      setLoading(true);

      const result = await restoreWalletFromMnemonic(
        validation.normalizedMnemonic
      );

      await setOnboardingCompleted(true);

      Alert.alert(
        'Wallet Berhasil Direstore',
        `DID berhasil dipulihkan:\n\n${result.identity.did}`,
        [
          {
            text: 'Lanjut Buat PIN',
            onPress: () => router.replace('/auth/create-pin'),
          },
        ]
      );
    } catch {
      setToast({
        visible: true,
        message: 'Restore wallet gagal. Periksa recovery phrase dan coba lagi.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="refresh-circle-outline" size={40} color="#2563EB" />
          </View>

          <Text style={styles.title}>Restore Wallet</Text>
          <Text style={styles.subtitle}>
            Masukkan 12 kata recovery phrase untuk memulihkan DID dan private key
            holder wallet.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Recovery Phrase</Text>

          <TextInput
            style={styles.textArea}
            placeholder="masukkan 12 kata recovery phrase"
            placeholderTextColor="#94A3B8"
            value={mnemonic}
            onChangeText={setMnemonic}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            textAlignVertical="top"
          />

          <Text style={styles.helperText}>
            Pisahkan setiap kata dengan spasi. Credential lama tidak otomatis
            direstore karena aplikasi belum memakai cloud backup credential.
          </Text>

          <Pressable
            style={[styles.restoreButton, loading && styles.disabledButton]}
            onPress={handleRestore}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="refresh-outline" size={20} color="#FFFFFF" />
            )}
            <Text style={styles.restoreButtonText}>
              {loading ? 'Memulihkan Wallet...' : 'Restore Wallet'}
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.backButton}
          onPress={() => router.replace('/auth/onboarding')}
        >
          <Text style={styles.backButtonText}>Kembali</Text>
        </Pressable>
      </ScrollView>

      <AppToast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((current) => ({ ...current, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingTop: 54, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 22 },
  iconCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    color: '#111827',
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  label: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
  },
  textArea: {
    minHeight: 150,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 18,
    padding: 14,
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  helperText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 12,
  },
  restoreButton: {
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
  disabledButton: { opacity: 0.65 },
  restoreButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  backButtonText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '900',
  },
});