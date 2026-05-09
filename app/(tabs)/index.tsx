import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

import { getUserProfile, UserProfile } from '../../src/Storage/profileStorage';
import { DIDData } from '../../src/types/did';
import { CredentialDocument } from '../../src/types/vc';
import { getDID } from '../../src/Storage/didStorage';
import { getCredentialDocuments } from '../../src/Services/documentCredentialService';
import { safeLogger } from '../../src/utils/safeLogger';

import AppToast from '../../components/ui/AppToast';
import AnimatedButton from '../../components/ui/AnimatedButton';
import SkeletonBox from '../../components/ui/SkeletonBox';
import AnimatedScreen from '../../components/ui/AnimatedScreen';

export default function HomeScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
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

      const userProfile = await getUserProfile();
      const did = await getDID();
      const docs = await getCredentialDocuments();

      setProfile(userProfile);
      setDidData(did);
      setDocuments(docs);
    } catch (error) {
      safeLogger.error('Failed to load dashboard');

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
        message: 'DID Address belum tersedia',
        type: 'error',
      });
      return;
    }

    await Clipboard.setStringAsync(didData.did);

    setToast({
      visible: true,
      message: 'DID Address berhasil disalin',
      type: 'success',
    });
  }

  function handleShowDIDQR() {
    if (!didData?.did) {
      setToast({
        visible: true,
        message: 'DID Address belum tersedia',
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
        <View style={styles.topHeader}>
          <View style={styles.profileRow}>
            {profile?.profileImageUri ? (
              <Image
                source={{ uri: profile.profileImageUri }}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.profileImageFallback}>
                <Text style={styles.profileImageFallbackText}>
                  {getInitial(profile?.fullName)}
                </Text>
              </View>
            )}

            <View>
              <Text style={styles.greetingText}>Halo,</Text>
              <Text style={styles.userName}>
                {profile?.fullName ?? 'Pengguna Wallet'}
              </Text>
            </View>
          </View>

          <Pressable style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={24} color="#111827" />
            <View style={styles.notificationDot} />
          </Pressable>
        </View>

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
                  'DID belum tersedia. Buat akun terlebih dahulu.'}
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
                <View style={styles.lockedDidNotice}>
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color="#F97316"
                  />
                  <Text style={styles.lockedDidText}>
                    DID dibuat otomatis saat pembuatan akun dan tidak dapat
                    dibuat manual dari dashboard.
                  </Text>
                </View>
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
                  <View key={item} style={styles.parentCredentialCard}>
                    <View style={styles.parentCredentialHeader}>
                      <SkeletonBox width={50} height={50} borderRadius={16} />
                      <View style={{ flex: 1 }}>
                        <SkeletonBox width="70%" height={17} />
                        <SkeletonBox
                          width="55%"
                          height={12}
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
                  Buat dummy credential dari halaman Wallet untuk menambahkan
                  credential parent ke dashboard.
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
                const status = getParentCredentialStatus(doc);
                const isValid = status.status === 'VALID';

                return (
                  <Pressable
                    key={doc.documentId}
                    style={({ pressed }) => [
                      styles.parentCredentialCard,
                      pressed && styles.parentCredentialCardPressed,
                    ]}
                    onPress={() =>
                      router.push({
                        pathname: '/credential/document/[documentId]',
                        params: { documentId: doc.documentId },
                      })
                    }
                  >
                    <View style={styles.parentCredentialHeader}>
                      <View style={styles.parentCredentialLeft}>
                        <View style={styles.parentCredentialIconBox}>
                          <Ionicons
                            name={getDocumentIcon(doc.documentType)}
                            size={25}
                            color="#2563EB"
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.parentCredentialTitle}>
                            {getDocumentDisplayName(doc)}
                          </Text>

                          <Text
                            style={styles.parentCredentialIssuer}
                            numberOfLines={1}
                          >
                            {getParentCredentialIssuer(doc)}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.parentStatusBadge,
                          isValid
                            ? styles.parentStatusValid
                            : styles.parentStatusExpired,
                        ]}
                      >
                        <Text
                          style={[
                            styles.parentStatusText,
                            isValid
                              ? styles.parentStatusTextValid
                              : styles.parentStatusTextExpired,
                          ]}
                        >
                          {status.label}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.parentCredentialFooter}>
                      <Text style={styles.parentCredentialHint}>
                        Klik untuk melihat detail atribut
                      </Text>

                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color="#94A3B8"
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
              Credential ditampilkan sebagai credential parent yang membungkus
              beberapa atribut identitas.
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

function getInitial(name?: string) {
  if (!name) return 'U';

  const names = name.trim().split(' ').filter(Boolean);

  if (names.length === 1) {
    return names[0].charAt(0).toUpperCase();
  }

  return `${names[0].charAt(0)}${names[1].charAt(0)}`.toUpperCase();
}

function getDocumentDisplayName(document: CredentialDocument) {
  if (document.documentName) {
    return document.documentName;
  }

  if (document.documentType === 'KTP') return 'KTP Digital';
  if (document.documentType === 'SIM') return 'SIM Digital';
  if (document.documentType === 'IJAZAH') return 'Ijazah Digital';

  return 'Credential Document';
}

function getDocumentIcon(documentType: string) {
  if (documentType === 'KTP') return 'id-card-outline';
  if (documentType === 'SIM') return 'car-outline';
  if (documentType === 'IJAZAH') return 'school-outline';

  return 'document-text-outline';
}

function getParentCredentialIssuer(document: CredentialDocument) {
  const mainCredential = getMainCredential(document);

  if (mainCredential?.issuer) {
    return mainCredential.issuer;
  }

  return 'Unknown Issuer';
}

function getParentCredentialStatus(document: CredentialDocument) {
  const mainCredential = getMainCredential(document);

  if (!mainCredential?.expirationDate) {
    return {
      status: 'VALID',
      label: 'VALID',
    };
  }

  const isExpired = new Date(mainCredential.expirationDate) < new Date();

  return {
    status: isExpired ? 'EXPIRED' : 'VALID',
    label: isExpired ? 'EXPIRED' : 'VALID',
  };
}

function getMainCredential(document: CredentialDocument) {
  const credentials = document.credentials ?? [];

  return (
    credentials.find(
      (vc) => vc.credentialSubject?.attributeType === 'legalName'
    ) ||
    credentials.find((vc) => vc.credentialSubject?.attributeType === 'nik') ||
    credentials.find(
      (vc) => vc.credentialSubject?.attributeType === 'licenseNumber'
    ) ||
    credentials.find(
      (vc) => vc.credentialSubject?.attributeType === 'studentId'
    ) ||
    credentials[0]
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingTop: 22,
    paddingBottom: 40,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  profileImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DBEAFE',
  },
  profileImageFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImageFallbackText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  greetingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
  },
  userName: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '900',
    marginTop: 2,
  },
  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 12,
    right: 13,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F97316',
  },
  didCard: {
    backgroundColor: '#FFFFFF',
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
  lockedDidNotice: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
  },
  lockedDidText: {
    flex: 1,
    color: '#9A3412',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
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
  parentCredentialCard: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  parentCredentialCardPressed: {
    borderColor: '#2563EB',
    backgroundColor: '#F8FAFC',
    transform: [{ scale: 0.99 }],
  },
  parentCredentialHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  parentCredentialLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  parentCredentialIconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentCredentialTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
    lineHeight: 21,
  },
  parentCredentialIssuer: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
    fontWeight: '700',
  },
  parentStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
  },
  parentStatusValid: {
    borderColor: '#166534',
    backgroundColor: '#DCFCE7',
  },
  parentStatusExpired: {
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  parentStatusText: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  parentStatusTextValid: {
    color: '#166534',
  },
  parentStatusTextExpired: {
    color: '#64748B',
  },
  parentCredentialFooter: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  parentCredentialHint: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
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