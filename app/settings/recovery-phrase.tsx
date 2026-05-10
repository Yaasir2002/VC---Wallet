import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

import { authenticateWalletAccess } from '../../src/Services/walletLockService';
import { getStoredMnemonicForBackup } from '../../src/Services/recoverableWalletIdentityService';
import AppToast from '../../components/ui/AppToast';

export default function RecoveryPhraseScreen() {
  const router = useRouter();

  const [mnemonic, setMnemonic] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'info',
  });

  const words = useMemo(() => mnemonic.split(' ').filter(Boolean), [mnemonic]);

  useEffect(() => {
    void revealMnemonic();
  }, []);

  async function revealMnemonic() {
    try {
      setLoading(true);

      const auth = await authenticateWalletAccess(
        'Masukkan PIN untuk melihat recovery phrase.'
      );

      if (!auth.success) {
        Alert.alert('Autentikasi Gagal', auth.reason || 'PIN tidak valid.', [
          {
            text: 'Kembali',
            onPress: () => router.back(),
          },
        ]);
        return;
      }

      const phrase = await getStoredMnemonicForBackup();
      setMnemonic(phrase);
    } catch {
      Alert.alert(
        'Recovery Phrase Tidak Tersedia',
        'Wallet ini belum memiliki recovery phrase. Kemungkinan wallet dibuat sebelum fitur backup ditambahkan.',
        [
          {
            text: 'Kembali',
            onPress: () => router.back(),
          },
        ]
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!mnemonic) {
      return;
    }

    await Clipboard.setStringAsync(mnemonic);

    setToast({
      visible: true,
      message: 'Recovery phrase berhasil disalin',
      type: 'success',
    });
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Memverifikasi akses...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back-outline" size={24} color="#111827" />
          </Pressable>

          <Text style={styles.title}>Recovery Phrase</Text>

          <View style={{ width: 44 }} />
        </View>

        <View style={styles.warningCard}>
          <Ionicons name="warning-outline" size={24} color="#C2410C" />
          <Text style={styles.warningText}>
            Jangan screenshot, jangan kirim lewat chat, dan jangan bagikan
            recovery phrase ini kepada siapa pun.
          </Text>
        </View>

        <View style={styles.mnemonicCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>12 Kata Recovery</Text>

            <Pressable style={styles.copyButton} onPress={handleCopy}>
              <Ionicons name="copy-outline" size={16} color="#2563EB" />
              <Text style={styles.copyButtonText}>Copy</Text>
            </Pressable>
          </View>

          <View style={styles.wordGrid}>
            {words.map((word, index) => (
              <View key={`${word}-${index}`} style={styles.wordBox}>
                <Text style={styles.wordIndex}>{index + 1}</Text>
                <Text style={styles.wordText}>{word}</Text>
              </View>
            ))}
          </View>
        </View>
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
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#64748B',
    fontWeight: '800',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '900',
  },
  warningCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  warningText: {
    flex: 1,
    color: '#9A3412',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  mnemonicCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '900',
  },
  copyButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  copyButtonText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '900',
  },
  wordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  wordBox: {
    width: '47%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wordIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 24,
  },
  wordText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
  },
});