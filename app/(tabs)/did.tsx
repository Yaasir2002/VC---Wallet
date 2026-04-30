import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';

import { DIDData } from '../../src/types/did';
import { saveDID, getDID, deleteDID } from '../../src/Storage/didStorage';
import { generateEthrDID } from '../../src/Services/didService';

import AppToast from '../../components/ui/AppToast';
import AnimatedButton from '../../components/ui/AnimatedButton';

export default function DIDScreen() {
  const [didData, setDidData] = useState<DIDData | null>(null);
  const [loading, setLoading] = useState(false);

  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'info',
  });

  async function loadDID() {
    try {
      const data = await getDID();
      setDidData(data);
    } catch {
      setToast({
        visible: true,
        message: 'Gagal mengambil DID',
        type: 'error',
      });
    }
  }

      const handleCreateDID = async () => {
      try {
        setLoading(true);

        const newDID = await generateEthrDID();

        await saveDID(newDID);
        setDidData(newDID);

        Alert.alert('Berhasil', 'DID berhasil dibuat menggunakan Veramo Agent.');
      } catch (error) {
        console.log(error);
        Alert.alert('Gagal', 'Gagal membuat DID menggunakan Veramo Agent.');
      } finally {
        setLoading(false);
      }
    };

  async function handleCopy(text?: string, label = 'Data') {
    if (!text) return;

    await Clipboard.setStringAsync(text);

    setToast({
      visible: true,
      message: `${label} berhasil disalin`,
      type: 'success',
    });
  }

  async function handleDeleteDID() {
    Alert.alert(
      'Hapus DID',
      'Apakah kamu yakin ingin menghapus DID dari wallet?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            await deleteDID();
            setDidData(null);

            setToast({
              visible: true,
              message: 'DID berhasil dihapus',
              type: 'success',
            });
          },
        },
      ]
    );
  }

  useEffect(() => {
    loadDID();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <LinearGradient
          colors={['#2563EB', '#1D4ED8', '#F97316']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View>
            <Text style={styles.heroLabel}>Digital Identity</Text>
            <Text style={styles.heroTitle}>Ethereum DID</Text>
            <Text style={styles.heroSubtitle}>
              Manage your decentralized identity for credential wallet.
            </Text>
          </View>

          <View style={styles.heroIcon}>
            <Ionicons name="finger-print-outline" size={36} color="#2563EB" />
          </View>
        </LinearGradient>

        {didData ? (
          <View style={styles.didCard}>
            <View style={styles.cardHeader}>
              <View style={styles.didIcon}>
                <Ionicons name="wallet-outline" size={28} color="#2563EB" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel}>Current Identity</Text>
                <Text style={styles.cardTitle}>Active DID</Text>
              </View>

              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>ACTIVE</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <Text style={styles.label}>DID Address</Text>
            <Text style={styles.didText}>{didData.did}</Text>

            <AnimatedButton
              style={styles.copyButton}
              onPress={() => handleCopy(didData.did, 'DID')}
            >
              <Ionicons name="copy-outline" size={16} color="#2563EB" />
              <Text style={styles.copyButtonText}>Copy DID Address</Text>
            </AnimatedButton>

            <View style={styles.infoRow}>
              <View style={styles.infoBox}>
                <View style={styles.infoIconBlue}>
                  <Ionicons name="git-network-outline" size={20} color="#2563EB" />
                </View>
                <Text style={styles.infoLabel}>Method</Text>
                <Text style={styles.infoValue}>{didData.method}</Text>
              </View>

              <View style={styles.infoBox}>
                <View style={styles.infoIconOrange}>
                  <Ionicons name="planet-outline" size={20} color="#F97316" />
                </View>
                <Text style={styles.infoLabel}>Network</Text>
                <Text style={styles.infoValue}>{didData.network ?? '-'}</Text>
              </View>
            </View>

            <Text style={styles.label}>Ethereum Address</Text>
            <Text style={styles.addressText}>{didData.address ?? '-'}</Text>

            {didData.address && (
              <AnimatedButton
                style={styles.copyButton}
                onPress={() => handleCopy(didData.address, 'Ethereum Address')}
              >
                <Ionicons name="copy-outline" size={16} color="#2563EB" />
                <Text style={styles.copyButtonText}>Copy Ethereum Address</Text>
              </AnimatedButton>
            )}

            <Text style={styles.label}>Created At</Text>
            <Text style={styles.createdText}>
              {new Date(didData.createdAt).toLocaleString()}
            </Text>

            <View style={styles.securityNotice}>
              <Ionicons name="lock-closed-outline" size={20} color="#F97316" />
              <Text style={styles.securityText}>
                Private key disimpan secara lokal menggunakan SecureStore dan
                tidak ditampilkan pada halaman ini.
              </Text>
            </View>

            <AnimatedButton style={styles.deleteButton} onPress={handleDeleteDID}>
              <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
              <Text style={styles.deleteButtonText}>Hapus DID</Text>
            </AnimatedButton>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="finger-print-outline" size={42} color="#2563EB" />
            </View>

            <Text style={styles.emptyTitle}>Belum Ada DID</Text>

            <Text style={styles.emptyText}>
              Buat Ethereum DID untuk mengaktifkan wallet identitas digital dan
              mulai menyimpan Verifiable Credential.
            </Text>

            <AnimatedButton
              style={styles.createButton}
              onPress={handleCreateDID}
              disabled={loading}
            >
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.createButtonText}>
                {loading ? 'Membuat DID...' : 'Create Ethereum DID'}
              </Text>
            </AnimatedButton>
          </View>
        )}

        <View style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={22} color="#2563EB" />
          <Text style={styles.noteText}>
            DID menggunakan format did:ethr:sepolia berbasis Ethereum address.
            Tahap ini membuat keypair lokal dan belum melakukan transaksi
            on-chain.
          </Text>
        </View>
      </ScrollView>

      <AppToast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
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
    paddingBottom: 40,
  },
  hero: {
    borderRadius: 28,
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 14,
    color: '#FFEDD5',
    fontWeight: '900',
  },
  heroTitle: {
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: '900',
    marginTop: 2,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#DBEAFE',
    marginTop: 8,
    lineHeight: 21,
    maxWidth: 240,
  },
  heroIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  didCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  didIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 20,
    color: '#111827',
    fontWeight: '900',
    marginTop: 2,
  },
  activeBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  activeBadgeText: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '900',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 18,
  },
  label: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '900',
    marginTop: 12,
  },
  didText: {
    fontSize: 13,
    color: '#2563EB',
    marginTop: 6,
    lineHeight: 20,
    fontWeight: '600',
  },
  addressText: {
    fontSize: 13,
    color: '#111827',
    marginTop: 6,
    lineHeight: 20,
    fontWeight: '700',
  },
  copyButton: {
    marginTop: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  copyButtonText: {
    color: '#2563EB',
    fontWeight: '900',
    fontSize: 13,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  infoBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoIconBlue: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  infoIconOrange: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
  },
  infoValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '900',
    marginTop: 3,
  },
  createdText: {
    fontSize: 14,
    color: '#111827',
    marginTop: 6,
    fontWeight: '700',
  },
  securityNotice: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 18,
    padding: 14,
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  securityText: {
    flex: 1,
    color: '#9A3412',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  deleteButton: {
    backgroundColor: '#DC2626',
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 26,
    padding: 24,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
  },
  emptyIcon: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 22,
  },
  createButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  noteCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 20,
    padding: 16,
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  noteText: {
    flex: 1,
    color: '#1E40AF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});