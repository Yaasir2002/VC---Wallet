import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';

import { DIDData } from '../../src/types/did';
import { CredentialDocument } from '../../src/types/vc';
import { getDID } from '../../src/Storage/didStorage';
import { getCredentialDocuments } from '../../src/Services/documentCredentialService';

import AppToast from '../../components/ui/AppToast';
import AnimatedButton from '../../components/ui/AnimatedButton';
import SkeletonBox from '../../components/ui/SkeletonBox';
import AnimatedScreen from '../../components/ui/AnimatedScreen';

export default function HomeScreen() {
  const router = useRouter();

  const [didData, setDidData] = useState<DIDData | null>(null);
  const [documents, setDocuments] = useState<CredentialDocument[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'info',
  });

  async function loadDashboard() {
    try {
      setLoadingDashboard(true);

      const did = await getDID();
      const docs = await getCredentialDocuments();

      setDidData(did);
      setDocuments(docs);
    } catch (error) {
      console.log('LOAD DASHBOARD ERROR:', error);

      setToast({
        visible: true,
        message: 'Gagal memuat dashboard',
        type: 'error',
      });
    } finally {
      setLoadingDashboard(false);
    }
  }

  async function handleCopyDID() {
    if (!didData?.did) return;

    await Clipboard.setStringAsync(didData.did);

    setToast({
      visible: true,
      message: 'DID berhasil disalin',
      type: 'success',
    });
  }

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [])
  );

  const totalAttributes = documents.reduce(
    (total, doc) => total + doc.credentials.length,
    0
  );

  const validDocuments = documents.filter((doc) => getDocumentStatus(doc).status === 'VALID').length;
  const expiredDocuments = documents.filter((doc) => getDocumentStatus(doc).status === 'EXPIRED').length;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <AnimatedScreen>
          <LinearGradient
            colors={['#2563EB', '#1D4ED8', '#F97316']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View>
              <Text style={styles.welcomeTextGradient}>SSI Wallet</Text>
              <Text style={styles.appTitleGradient}>Dashboard</Text>
              <Text style={styles.subtitleGradient}>
                Kelola DID, Verifiable Credential, dan permintaan verifikasi
                dari satu tempat.
              </Text>
            </View>

            <View style={styles.logoCircleGradient}>
              <Ionicons name="shield-checkmark" size={34} color="#2563EB" />
            </View>
          </LinearGradient>
        </AnimatedScreen>

        <AnimatedScreen delay={120}>
          {loadingDashboard ? (
            <View style={styles.didCard}>
              <SkeletonBox width="60%" height={20} />
              <SkeletonBox width="100%" height={16} style={{ marginTop: 16 }} />
              <SkeletonBox width="80%" height={16} style={{ marginTop: 10 }} />

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
                <SkeletonBox width="48%" height={70} borderRadius={16} />
                <SkeletonBox width="48%" height={70} borderRadius={16} />
              </View>
            </View>
          ) : (
            <View style={styles.didCard}>
              <View style={styles.didHeader}>
                <View style={styles.didIcon}>
                  <Ionicons
                    name="finger-print-outline"
                    size={28}
                    color="#2563EB"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.cardLabel}>Decentralized Identifier</Text>
                  <Text style={styles.cardTitle}>
                    {didData ? 'Active DID' : 'DID Belum Dibuat'}
                  </Text>
                </View>

                <View style={didData ? styles.activeBadge : styles.inactiveBadge}>
                  <Text
                    style={
                      didData ? styles.activeBadgeText : styles.inactiveBadgeText
                    }
                  >
                    {didData ? 'ACTIVE' : 'SETUP'}
                  </Text>
                </View>
              </View>

              <Text style={styles.didAddressLabel}>DID Address</Text>
              <Text style={styles.didAddress}>
                {didData?.did ??
                  'Buat DID terlebih dahulu agar wallet identitas digital aktif.'}
              </Text>

              {didData ? (
                <AnimatedButton
                  style={styles.copyDidButton}
                  onPress={handleCopyDID}
                >
                  <Ionicons name="copy-outline" size={16} color="#2563EB" />
                  <Text style={styles.copyDidText}>Copy DID Address</Text>
                </AnimatedButton>
              ) : (
                <AnimatedButton
                  style={styles.createButton}
                  onPress={() => router.push('/(tabs)/did')}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.createButtonText}>Create DID</Text>
                </AnimatedButton>
              )}

              <View style={styles.didMetaRow}>
                <View style={styles.metaBox}>
                  <Text style={styles.metaLabel}>Method</Text>
                  <Text style={styles.metaValue}>{didData?.method ?? '-'}</Text>
                </View>

                <View style={styles.metaBox}>
                  <Text style={styles.metaLabel}>Network</Text>
                  <Text style={styles.metaValue}>{didData?.network ?? '-'}</Text>
                </View>
              </View>
            </View>
          )}
        </AnimatedScreen>

        <AnimatedScreen delay={220}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={styles.statIconBlue}>
                <Ionicons name="folder-open-outline" size={24} color="#2563EB" />
              </View>
              <Text style={styles.statNumber}>
                {loadingDashboard ? '-' : documents.length}
              </Text>
              <Text style={styles.statLabel}>VC Documents</Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIconOrange}>
                <Ionicons name="list-outline" size={24} color="#F97316" />
              </View>
              <Text style={styles.statNumber}>
                {loadingDashboard ? '-' : totalAttributes}
              </Text>
              <Text style={styles.statLabel}>Attributes</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={styles.statIconGreen}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={24}
                  color="#16A34A"
                />
              </View>
              <Text style={styles.statNumber}>
                {loadingDashboard ? '-' : validDocuments}
              </Text>
              <Text style={styles.statLabel}>Valid</Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIconRed}>
                <Ionicons name="time-outline" size={24} color="#DC2626" />
              </View>
              <Text style={styles.statNumber}>
                {loadingDashboard ? '-' : expiredDocuments}
              </Text>
              <Text style={styles.statLabel}>Expired</Text>
            </View>
          </View>
        </AnimatedScreen>

        <AnimatedScreen delay={320}>
          <View style={styles.documentSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Verifiable Credentials</Text>

              <Pressable onPress={() => router.push('/(tabs)/wallet')}>
                <Text style={styles.viewAllText}>View Wallet</Text>
              </Pressable>
            </View>

            {loadingDashboard ? (
              <View>
                {[1, 2].map((item) => (
                  <View key={item} style={styles.documentCard}>
                    <View style={styles.documentHeader}>
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
                  </View>
                ))}
              </View>
            ) : documents.length === 0 ? (
              <View style={styles.emptyCredential}>
                <Ionicons name="file-tray-outline" size={34} color="#9CA3AF" />
                <Text style={styles.emptyTitleSmall}>Belum Ada VC</Text>
                <Text style={styles.emptyText}>
                  Tambahkan KTP Digital, SIM, Ijazah, atau kredensial lain dari
                  halaman Wallet.
                </Text>

                <AnimatedButton
                  style={styles.goWalletButton}
                  onPress={() => router.push('/(tabs)/wallet')}
                >
                  <Ionicons name="wallet-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.goWalletButtonText}>Open Wallet</Text>
                </AnimatedButton>
              </View>
            ) : (
              documents.map((doc) => {
                const status = getDocumentStatus(doc);

                return (
                  <Pressable
                    key={doc.documentId}
                    style={styles.documentCard}
                    onPress={() =>
                      router.push({
                        pathname: '/credential/document/[documentId]',
                        params: { documentId: doc.documentId },
                      })
                    }
                  >
                    <View style={styles.documentHeader}>
                      <View style={styles.documentIcon}>
                        <Ionicons
                          name={getDocumentIcon(doc.documentType)}
                          size={26}
                          color="#2563EB"
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.documentTitle}>
                          {doc.documentName}
                        </Text>
                        <Text style={styles.documentSubtitle}>
                          {doc.documentType} • {doc.credentials.length} atribut
                        </Text>
                      </View>

                      <View
                        style={
                          status.status === 'VALID'
                            ? styles.validBadge
                            : styles.expiredBadge
                        }
                      >
                        <Text
                          style={
                            status.status === 'VALID'
                              ? styles.validBadgeText
                              : styles.expiredBadgeText
                          }
                        >
                          {status.label}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.attributePreviewWrap}>
                      {doc.credentials.slice(0, 3).map((vc) => (
                        <View key={vc.id} style={styles.attributeChip}>
                          <Text style={styles.attributeChipText}>
                            {vc.credentialSubject.attributeName}
                          </Text>
                        </View>
                      ))}

                      {doc.credentials.length > 3 && (
                        <View style={styles.attributeChipMore}>
                          <Text style={styles.attributeChipMoreText}>
                            +{doc.credentials.length - 3}
                          </Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        </AnimatedScreen>

        <AnimatedScreen delay={420}>
          <AnimatedButton
            style={styles.scanRequestButton}
            onPress={() => router.push('/verifier/scan')}
          >
            <View style={styles.scanIcon}>
              <Ionicons name="scan-outline" size={26} color="#FFFFFF" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.scanTitle}>Scan Verification Request</Text>
              <Text style={styles.scanSubtitle}>
                Pindai QR dari verifikator untuk merespons permintaan verifikasi.
              </Text>
            </View>

            <Ionicons name="chevron-forward-outline" size={22} color="#FFFFFF" />
          </AnimatedButton>
        </AnimatedScreen>

        <AnimatedScreen delay={520}>
          <View style={styles.securityCard}>
            <Ionicons name="lock-closed-outline" size={22} color="#F97316" />
            <Text style={styles.securityText}>
              Wallet dilindungi dengan secure storage, PIN lokal, dan biometrik.
              Credential ditampilkan dalam bentuk dokumen digital yang dapat
              dipresentasikan secara selektif.
            </Text>
          </View>
        </AnimatedScreen>
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

function getDocumentIcon(documentType: string) {
  if (documentType === 'KTP') return 'id-card-outline';
  if (documentType === 'SIM') return 'car-outline';
  if (documentType === 'IJAZAH') return 'school-outline';

  return 'document-text-outline';
}

function getDocumentStatus(document: CredentialDocument) {
  const now = new Date();

  const expirationDates = document.credentials
    .map((vc) => vc.expirationDate)
    .filter(Boolean)
    .map((date) => new Date(date as string));

  if (expirationDates.length === 0) {
    return {
      status: 'VALID',
      label: 'VALID',
    };
  }

  const hasExpired = expirationDates.some((date) => date < now);

  return {
    status: hasExpired ? 'EXPIRED' : 'VALID',
    label: hasExpired ? 'EXPIRED' : 'VALID',
  };
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
  heroGradient: {
    borderRadius: 28,
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeTextGradient: {
    fontSize: 14,
    color: '#FFEDD5',
    fontWeight: '900',
  },
  appTitleGradient: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  subtitleGradient: {
    fontSize: 14,
    color: '#DBEAFE',
    marginTop: 8,
    lineHeight: 21,
    maxWidth: 240,
  },
  logoCircleGradient: {
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
  didHeader: {
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
    fontSize: 19,
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
  inactiveBadge: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  activeBadgeText: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '900',
  },
  inactiveBadgeText: {
    color: '#C2410C',
    fontSize: 11,
    fontWeight: '900',
  },
  didAddressLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '800',
    marginTop: 18,
  },
  didAddress: {
    fontSize: 13,
    color: '#2563EB',
    marginTop: 6,
    lineHeight: 20,
    fontWeight: '600',
  },
  copyDidButton: {
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
  copyDidText: {
    color: '#2563EB',
    fontWeight: '900',
    fontSize: 13,
  },
  createButton: {
    backgroundColor: '#2563EB',
    marginTop: 14,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  didMetaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  metaBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
  },
  metaLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
  },
  metaValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '900',
    marginTop: 4,
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
  statIconGreen: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconRed: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 23,
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
  documentSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  viewAllText: {
    color: '#2563EB',
    fontWeight: '900',
    fontSize: 13,
  },
  documentCard: {
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  documentIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
  },
  documentSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '700',
  },
  validBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
  },
  expiredBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
  },
  validBadgeText: {
    color: '#166534',
    fontSize: 10,
    fontWeight: '900',
  },
  expiredBadgeText: {
    color: '#991B1B',
    fontSize: 10,
    fontWeight: '900',
  },
  attributePreviewWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  attributeChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  attributeChipText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '800',
  },
  attributeChipMore: {
    backgroundColor: '#FFEDD5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  attributeChipMoreText: {
    fontSize: 12,
    color: '#C2410C',
    fontWeight: '900',
  },
  emptyCredential: {
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
  },
  emptyTitleSmall: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '900',
    marginTop: 10,
  },
  emptyText: {
    color: '#6B7280',
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  goWalletButton: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  goWalletButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  scanRequestButton: {
    backgroundColor: '#2563EB',
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scanIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  scanSubtitle: {
    color: '#DBEAFE',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
    fontWeight: '700',
  },
  securityCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 20,
    padding: 16,
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
});