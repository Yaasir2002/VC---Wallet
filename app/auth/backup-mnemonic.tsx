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

import { getStoredMnemonicForBackup } from '../../src/Services/recoverableWalletIdentityService';
import { markMnemonicBackedUp } from '../../src/Storage/secureWalletStorage';
import { authenticateWalletAccess } from '../../src/Services/walletLockService';
import AppToast from '../../components/ui/AppToast';

export default function BackupMnemonicScreen() {
  const router = useRouter();

  const [mnemonic, setMnemonic] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'info',
  });

  const words = useMemo(() => {
    return mnemonic.split(' ').filter(Boolean);
  }, [mnemonic]);

  useEffect(() => {
    void loadMnemonic();
  }, []);

  async function loadMnemonic() {
    try {
      setLoading(true);

      const auth = await authenticateWalletAccess(
        'Masukkan PIN untuk menampilkan recovery phrase.'
      );

      if (!auth.success) {
        Alert.alert(
          'Autentikasi Gagal',
          auth.reason || 'PIN tidak valid.',
          [
            {
              text: 'Kembali',
              onPress: () => router.replace('/(tabs)'),
            },
          ]
        );
        return;
      }

      const storedMnemonic = await getStoredMnemonicForBackup();

      setMnemonic(storedMnemonic);
      setRevealed(true);
    } catch {
      Alert.alert(
        'Recovery Phrase Tidak Tersedia',
        'Recovery phrase belum tersedia pada wallet ini.',
        [
          {
            text: 'Kembali',
            onPress: () => router.replace('/(tabs)'),
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

  async function handleContinue() {
    if (!confirmed) {
      setToast({
        visible: true,
        message: 'Centang konfirmasi terlebih dahulu.',
        type: 'error',
      });
      return;
    }

    await markMnemonicBackedUp();
    router.replace('/(tabs)');
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Membuka recovery phrase...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark-outline" size={38} color="#2563EB" />
          </View>

          <Text style={styles.title}>Backup Recovery Phrase</Text>
          <Text style={styles.subtitle}>
            Simpan 12 kata ini di tempat yang aman. Phrase ini digunakan untuk
            memulihkan DID dan private key wallet.
          </Text>
        </View>

        <View style={styles.warningCard}>
          <Ionicons name="warning-outline" size={24} color="#C2410C" />
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>Penting</Text>
            <Text style={styles.warningText}>
              Jangan bagikan recovery phrase kepada siapa pun. Jika phrase
              hilang, wallet tidak bisa dipulihkan. Jika orang lain memilikinya,
              mereka dapat memulihkan identitas wallet kamu.
            </Text>
          </View>
        </View>

        <View style={styles.mnemonicCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>12-Word Recovery Phrase</Text>

            <Pressable style={styles.copyButton} onPress={handleCopy}>
              <Ionicons name="copy-outline" size={16} color="#2563EB" />
              <Text style={styles.copyButtonText}>Copy</Text>
            </Pressable>
          </View>

          <View style={styles.wordGrid}>
            {revealed &&
              words.map((word, index) => (
                <View key={`${word}-${index}`} style={styles.wordBox}>
                  <Text style={styles.wordIndex}>{index + 1}</Text>
                  <Text style={styles.wordText}>{word}</Text>
                </View>
              ))}
          </View>
        </View>

        <Pressable
          style={styles.confirmRow}
          onPress={() => setConfirmed((value) => !value)}
        >
          <Ionicons
            name={confirmed ? 'checkbox-outline' : 'square-outline'}
            size={24}
            color={confirmed ? '#2563EB' : '#64748B'}
          />
          <Text style={styles.confirmText}>
            Saya sudah menyimpan recovery phrase ini di tempat yang aman.
          </Text>
        </Pressable>

        <Pressable
          style={[styles.continueButton, !confirmed && styles.disabledButton]}
          onPress={handleContinue}
        >
          <Text style={styles.continueButtonText}>Lanjut Masuk Wallet</Text>
          <Ionicons name="arrow-forward-outline" size={20} color="#FFFFFF" />
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
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingTop: 54,
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
    alignItems: 'center',
    marginBottom: 20,
  },
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
  warningCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  warningTitle: {
    color: '#9A3412',
    fontSize: 15,
    fontWeight: '900',
  },
  warningText: {
    color: '#9A3412',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 4,
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
  confirmRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  confirmText: {
    flex: 1,
    color: '#111827',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
  },
  continueButton: {
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
    opacity: 0.55,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});