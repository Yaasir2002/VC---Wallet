import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';

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
  const [showDIDQR, setShowDIDQR] = useState(false);

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
    if (!didData?.did) {
      setToast({
        visible: true,
        message: 'DID belum tersedia',
        type: 'error',
      });
      return;
    }

    await Clipboard.setStringAsync(didData.did);

    setToast({
      visible: true,
      message: 'DID berhasil disalin',
      type: 'success',
    });
  }

  function handleShowDIDQR() {
    if (!didData?.did) {
      setToast({
        visible: true,
        message: 'DID belum tersedia',
        type: 'error',
      });
      return;
    }

    setShowDIDQR(true);
  }

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [])
  );

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
                Kelola DID, dokumen kredensial digital, dan permintaan
                verifikasi dari satu tempat.
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
                <View style={styles.didActionRow}>
                  <AnimatedButton
                    style={styles.copyDidButton}
                    onPress={handleCopyDID}
                  >
                    <Ionicons name="copy-outline" size={16} color="#2563EB" />
                    <Text style={styles.copyDidText}>Copy DID</Text>
                  </AnimatedButton>

                  <AnimatedButton
                    style={styles.qrDidButton}
                    onPress={handleShowDIDQR}
                  >
                    <Ionicons name="qr-code-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.qrDidText}>Generate QR</Text>
                  </AnimatedButton>
                </View>
              ) : (
                <AnimatedButton
                  style={styles.createButton}
                  onPress={() => router.push('/(tabs)/did')}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.createButtonText}>Create DID</Text>
                </AnimatedButton>
              )}
            </View>
          )}
        </AnimatedScreen>

        <AnimatedScreen delay={220}>
          <View style={styles.documentSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My VC Documents</Text>

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
                          {getDocumentDisplayName(doc)}
                        </Text>

                        <Text style={styles.documentSubtitle}>
                          {doc.documentType} Credential
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

                    <View style={styles.documentFooter}>
                      <Text style={styles.documentHint}>
                        Klik untuk melihat detail isi credential
                      </Text>

                      <Ionicons
                        name="chevron-forward-outline"
                        size={18}
                        color="#6B7280"
                      />
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        </AnimatedScreen>

        <AnimatedScreen delay={320}>
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

        <AnimatedScreen delay={420}>
          <View style={styles.securityCard}>
            <Ionicons name="lock-closed-outline" size={22} color="#F97316" />
            <Text style={styles.securityText}>
              Wallet dilindungi dengan secure storage, PIN lokal, dan biometrik.
              Credential ditampilkan sebagai dokumen digital seperti KTP, SIM,
              dan Ijazah.
            </Text>
          </View>
        </AnimatedScreen>
      </ScrollView>

      <Modal visible={showDIDQR} transparent animationType="fade">
        <View style={styles.qrModalOverlay}>
          <View style={styles.qrModalBox}>
            <View style={styles.qrModalIcon}>
              <Ionicons name="qr-code-outline" size={34} color="#2563EB" />
            </View>

            <Text style={styles.qrModalTitle}>DID QR Code</Text>
            <Text style={styles.qrModalSubtitle}>
              QR ini berisi DID Address wallet kamu.
            </Text>

            <View style={styles.qrContainer}>
              {didData?.did ? <QRCode value={didData.did} size={220} /> : null}
            </View>

            <Text style={styles.qrDidAddress} numberOfLines={4}>
              {didData?.did}
            </Text>

            <View style={styles.qrModalActionRow}>
              <Pressable style={styles.qrCopyButton} onPress={handleCopyDID}>
                <Ionicons name="copy-outline" size={16} color="#2563EB" />
                <Text style={styles.qrCopyButtonText}>Copy DID</Text>
              </Pressable>

              <Pressable
                style={styles.qrCloseButton}
                onPress={() => setShowDIDQR(false)}
              >
                <Text style={styles.qrCloseButtonText}>Tutup</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <AppToast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />
    </View>
  );
}

function getDocumentDisplayName(document: CredentialDocument) {
  if (document.documentType === 'KTP') return 'KTP Digital';
  if (document.documentType === 'SIM') return 'SIM Digital';
  if (document.documentType === 'IJAZAH') return 'Ijazah Digital';

  return document.documentName || 'Credential Document';
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
  didActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  copyDidButton: {
    flex: 1,
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
  qrDidButton: {
    flex: 1,
    backgroundColor: '#F97316',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  qrDidText: {
    color: '#FFFFFF',
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
  documentFooter: {
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  documentHint: {
    color: '#6B7280',
    fontSize: 12,
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
  qrModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  qrModalBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 22,
    alignItems: 'center',
  },
  qrModalIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  qrModalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
  },
  qrModalSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 18,
    textAlign: 'center',
  },
  qrContainer: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  qrDidAddress: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 16,
  },
  qrModalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    width: '100%',
  },
  qrCopyButton: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  qrCopyButtonText: {
    color: '#2563EB',
    fontWeight: '900',
    fontSize: 13,
  },
  qrCloseButton: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCloseButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
});