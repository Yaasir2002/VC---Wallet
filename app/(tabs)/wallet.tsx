import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';

import { VerifiableCredential } from '../../src/types/vc';
import { saveVC, getAllVCs, deleteAllVCs } from '../../src/Storage/vcStorage';
import { dummyKtpVC } from '../../src/data/dummyVc';

import AppToast from '../../components/ui/AppToast';
import AnimatedButton from '../../components/ui/AnimatedButton';
import SkeletonBox from '../../components/ui/SkeletonBox';

export default function WalletScreen() {
  const router = useRouter();

  const [credentials, setCredentials] = useState<VerifiableCredential[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingVC, setLoadingVC] = useState(true);

  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'info',
  });

  async function loadVCs() {
    try {
      setLoadingVC(true);

      const data = await getAllVCs();
      setCredentials(data);
    } catch {
      setToast({
        visible: true,
        message: 'Gagal mengambil credential',
        type: 'error',
      });
    } finally {
      setLoadingVC(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadVCs();
    }, [])
  );

  async function handleAddDummyVC() {
    try {
      setLoading(true);

      const newVC: VerifiableCredential = {
        ...dummyKtpVC,
        id: `vc-ktp-${Date.now()}`,
        issuanceDate: new Date().toISOString(),
      };

      await saveVC(newVC);
      await loadVCs();

      setToast({
        visible: true,
        message: 'Credential dummy berhasil disimpan',
        type: 'success',
      });
    } catch {
      setToast({
        visible: true,
        message: 'Gagal menyimpan credential',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAllVCs() {
    try {
      await deleteAllVCs();
      setCredentials([]);

      setToast({
        visible: true,
        message: 'Semua credential berhasil dihapus',
        type: 'success',
      });
    } catch {
      setToast({
        visible: true,
        message: 'Gagal menghapus credential',
        type: 'error',
      });
    }
  }

  const verifiedCount = credentials.filter((vc) => !!vc.proof).length;

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
            <Text style={styles.heroLabel}>Credential Wallet</Text>
            <Text style={styles.heroTitle}>My Credentials</Text>
            <Text style={styles.heroSubtitle}>
              Store, manage, and present your Verifiable Credentials securely.
            </Text>
          </View>

          <View style={styles.heroIcon}>
            <Ionicons name="id-card-outline" size={36} color="#2563EB" />
          </View>
        </LinearGradient>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIconBlue}>
              <Ionicons
                name="file-tray-full-outline"
                size={24}
                color="#2563EB"
              />
            </View>
            <Text style={styles.statNumber}>
              {loadingVC ? '-' : credentials.length}
            </Text>
            <Text style={styles.statLabel}>Total VC</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconOrange}>
              <Ionicons
                name="shield-checkmark-outline"
                size={24}
                color="#F97316"
              />
            </View>
            <Text style={styles.statNumber}>
              {loadingVC ? '-' : verifiedCount}
            </Text>
            <Text style={styles.statLabel}>With Proof</Text>
          </View>
        </View>

        <View style={styles.actionCard}>
          <Text style={styles.sectionTitle}>Wallet Actions</Text>

          <View style={styles.actionRow}>
            <AnimatedButton
              style={styles.primaryButton}
              onPress={() => router.push('/credential/import')}
            >
              <Ionicons name="download-outline" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Import VC</Text>
            </AnimatedButton>

            <AnimatedButton
              style={styles.secondaryButton}
              onPress={handleAddDummyVC}
              disabled={loading}
            >
              <Ionicons name="add-circle-outline" size={20} color="#2563EB" />
            </AnimatedButton>

            {credentials.length > 0 && (
              <AnimatedButton
                style={styles.dangerButton}
                onPress={handleDeleteAllVCs}
              >
                <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
              </AnimatedButton>
            )}
          </View>
        </View>

        {loadingVC ? (
          <View style={styles.listSection}>
            {[1, 2, 3].map((item) => (
              <View key={item} style={styles.credentialCard}>
                <View style={styles.cardHeader}>
                  <SkeletonBox width={52} height={52} borderRadius={26} />

                  <View style={{ flex: 1 }}>
                    <SkeletonBox width="70%" height={16} />
                    <SkeletonBox
                      width="50%"
                      height={13}
                      style={{ marginTop: 8 }}
                    />
                  </View>
                </View>

                <View style={styles.divider} />

                <SkeletonBox width="100%" height={14} />
                <SkeletonBox width="80%" height={14} style={{ marginTop: 10 }} />
                <SkeletonBox
                  width="45%"
                  height={30}
                  borderRadius={999}
                  style={{ marginTop: 16 }}
                />
              </View>
            ))}
          </View>
        ) : credentials.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="wallet-outline" size={44} color="#2563EB" />
            </View>

            <Text style={styles.emptyTitle}>Wallet Masih Kosong</Text>

            <Text style={styles.emptyText}>
              Import Verifiable Credential pertama kamu untuk mulai menggunakan
              fitur presentasi dan verifikasi identitas digital.
            </Text>

            <AnimatedButton
              style={styles.emptyButton}
              onPress={() => router.push('/credential/import')}
            >
              <Ionicons name="download-outline" size={20} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Import Credential</Text>
            </AnimatedButton>
          </View>
        ) : (
          <View style={styles.listSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Credential List</Text>
              <Text style={styles.countText}>{credentials.length} items</Text>
            </View>

            {credentials.map((vc) => (
              <Pressable
                key={vc.id}
                style={styles.credentialCard}
                onPress={() =>
                  router.push({
                    pathname: '/credential/[id]',
                    params: { id: vc.id },
                  })
                }
              >
                <View style={styles.cardHeader}>
                  <View style={styles.credentialIcon}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={28}
                      color="#2563EB"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.credentialTitle}>
                      {vc.type.includes('IdentityCredential')
                        ? 'Identity Credential'
                        : 'Verifiable Credential'}
                    </Text>

                    <Text style={styles.credentialSubtitle}>
                      Issued by {vc.issuer}
                    </Text>
                  </View>

                  <View
                    style={vc.proof ? styles.verifiedBadge : styles.pendingBadge}
                  >
                    <Text
                      style={
                        vc.proof
                          ? styles.verifiedBadgeText
                          : styles.pendingBadgeText
                      }
                    >
                      {vc.proof ? 'PROOF' : 'NO PROOF'}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <Text style={styles.label}>Credential ID</Text>
                <Text style={styles.value}>{vc.id}</Text>

                <View style={styles.subjectBox}>
                  <View>
                    <Text style={styles.label}>Subject Name</Text>
                    <Text style={styles.subjectValue}>
                      {vc.credentialSubject.name ?? '-'}
                    </Text>
                  </View>

                  <View style={styles.subjectIcon}>
                    <Ionicons name="person-outline" size={20} color="#F97316" />
                  </View>
                </View>

                <Text style={styles.label}>Issued At</Text>
                <Text style={styles.value}>
                  {new Date(vc.issuanceDate).toLocaleString()}
                </Text>

                <View style={styles.footerRow}>
                  <View style={styles.localBadge}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={15}
                      color="#166534"
                    />
                    <Text style={styles.localBadgeText}>Stored Locally</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailText}>Detail</Text>
                    <Ionicons
                      name="chevron-forward-outline"
                      size={18}
                      color="#6B7280"
                    />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={22} color="#2563EB" />
          <Text style={styles.noteText}>
            Credential disimpan secara lokal pada perangkat. Untuk versi
            produksi, credential dapat dienkripsi dan diverifikasi dengan tanda
            tangan kriptografi.
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
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statIconBlue: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconOrange: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
    marginTop: 12,
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '700',
    marginTop: 2,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: '#DBEAFE',
    width: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButton: {
    backgroundColor: '#DC2626',
    width: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 88,
    height: 88,
    borderRadius: 44,
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
  emptyButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  listSection: {
    marginTop: 18,
  },
  sectionHeader: {
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2563EB',
  },
  credentialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  credentialIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  credentialTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },
  credentialSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 3,
  },
  verifiedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pendingBadge: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
  },
  verifiedBadgeText: {
    color: '#166534',
    fontSize: 10,
    fontWeight: '900',
  },
  pendingBadgeText: {
    color: '#C2410C',
    fontSize: 10,
    fontWeight: '900',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '800',
    marginTop: 8,
  },
  value: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
    marginTop: 4,
    lineHeight: 19,
  },
  subjectBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subjectValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '900',
    marginTop: 4,
  },
  subjectIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  localBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  localBadgeText: {
    color: '#166534',
    fontWeight: '900',
    fontSize: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    color: '#6B7280',
    fontWeight: '900',
    fontSize: 13,
  },
  noteCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 20,
    padding: 16,
    marginTop: 4,
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