import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';

import { authenticateWalletAccess } from '../../src/Services/walletLockService';
import { deleteVCsByDocumentId } from '../../src/Storage/vcStorage';
import { CredentialDocument } from '../../src/types/vc';
import { getCredentialDocuments } from '../../src/Services/documentCredentialService';
import { getDocumentIcon } from '../../src/utils/credentialUtils';

import AppToast from '../../components/ui/AppToast';
import AnimatedButton from '../../components/ui/AnimatedButton';
import SkeletonBox from '../../components/ui/SkeletonBox';

type ToastState = {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
};

function getSafeErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();

  if (!message) {
    return fallback;
  }

  const unsafePatterns = [
    /stack/i,
    /token/i,
    /private/i,
    /secret/i,
    /key/i,
    /jwt/i,
    /file:\/\//i,
    /documentDirectory/i,
    /SecureStore/i,
    /AsyncStorage/i,
  ];

  if (unsafePatterns.some((pattern) => pattern.test(message))) {
    return fallback;
  }

  return message.slice(0, 160);
}

function getCredentialIssuerText(document: CredentialDocument): string {
  const credential = document.credentials?.[0];

  if (!credential) return 'Unknown Issuer';

  const issuer = credential.issuer;

  if (typeof issuer === 'string') return issuer;

  if (issuer && typeof issuer === 'object') {
    if (typeof issuer.name === 'string') return issuer.name;
    if (typeof issuer.id === 'string') return issuer.id;
  }

  return 'Unknown Issuer';
}

function getCredentialStatus(document: CredentialDocument) {
  const credential = document.credentials?.[0];

  if (
    credential?.verificationStatus === 'signature_verified' ||
    credential?.signatureVerified === true ||
    credential?.metadata?.verificationStatus === 'signature_verified'
  ) {
    return { status: 'VALID', label: 'VALID' };
  }

  const validUntil =
    credential?.credentialSubject?.['Berlaku Hingga'] ||
    credential?.credentialSubject?.berlakuHingga ||
    credential?.credentialSubject?.validUntilText ||
    credential?.validUntil ||
    credential?.expirationDate;

  if (!validUntil) {
    return { status: 'VALID', label: 'VALID' };
  }

  const normalized = String(validUntil).trim().toLowerCase();

  if (
    normalized === 'seumur hidup' ||
    normalized === 'berlaku seumur hidup' ||
    normalized === 'lifetime'
  ) {
    return { status: 'VALID', label: 'VALID' };
  }

  const date = new Date(String(validUntil));

  if (Number.isNaN(date.getTime())) {
    return { status: 'VALID', label: 'VALID' };
  }

  const expired = date < new Date();

  return {
    status: expired ? 'EXPIRED' : 'VALID',
    label: expired ? 'EXPIRED' : 'VALID',
  };
}

function getDocumentDisplayName(document: CredentialDocument): string {
  if (document.documentName) return document.documentName;

  if (document.documentType === 'KTP') return 'KTP (Kartu Tanda Penduduk)';
  if (document.documentType === 'KTM') return 'KTM (Kartu Tanda Mahasiswa)';
  if (document.documentType === 'SIM') return 'SIM (Surat Izin Mengemudi)';
  if (document.documentType === 'IJAZAH') return 'Ijazah Digital';

  return 'Credential Document';
}

export default function WalletScreen() {
  const router = useRouter();

  const [documents, setDocuments] = useState<CredentialDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(
    null
  );

  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: '',
    type: 'info',
  });

  const loadDocuments = useCallback(async () => {
    try {
      setLoadingDocs(true);

      const docs = await getCredentialDocuments();
      setDocuments(docs);
    } catch {
      setToast({
        visible: true,
        message: 'Gagal mengambil dokumen credential',
        type: 'error',
      });
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDocuments();
    }, [loadDocuments])
  );

  function handleAddCredential() {
    router.push('/credential/create');
  }

  function handleScanQR() {
    router.push('/wallet/scan-qr');
  }

  async function handleOpenDocument(document: CredentialDocument) {
    const auth = await authenticateWalletAccess(
      'Autentikasi diperlukan untuk membuka detail credential.'
    );

    if (!auth.success) {
      setToast({
        visible: true,
        message: auth.reason || 'Autentikasi gagal',
        type: 'error',
      });
      return;
    }

    router.push({
      pathname: '/credential/document/[documentId]',
      params: { documentId: document.documentId },
    });
  }

  async function handleDeleteDocument(document: CredentialDocument) {
    const auth = await authenticateWalletAccess(
      'Autentikasi diperlukan untuk menghapus credential.'
    );

    if (!auth.success) {
      setToast({
        visible: true,
        message: auth.reason || 'Autentikasi gagal',
        type: 'error',
      });
      return;
    }

    const documentName = document.documentName || 'Credential';

    Alert.alert(
      'Hapus Credential',
      `Apakah kamu yakin ingin menghapus credential "${documentName}" dari wallet? Credential lain tidak akan ikut terhapus.`,
      [
        {
          text: 'Batal',
          style: 'cancel',
        },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              setDeletingDocumentId(document.documentId);

              await deleteVCsByDocumentId(document.documentId);

              setDocuments((currentDocuments) =>
                currentDocuments.filter(
                  (item) => item.documentId !== document.documentId
                )
              );

              setToast({
                visible: true,
                message: 'Credential berhasil dihapus',
                type: 'success',
              });

              await loadDocuments();
            } catch (error) {
              setToast({
                visible: true,
                message: getSafeErrorMessage(error, 'Gagal menghapus credential'),
                type: 'error',
              });
            } finally {
              setDeletingDocumentId(null);
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  const totalAttributes = documents.reduce(
    (total, doc) => total + doc.credentials.length,
    0
  );

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <LinearGradient
          colors={['#2563EB', '#1D4ED8', '#F97316']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View>
            <Text style={styles.heroLabel}>Credential Wallet</Text>
            <Text style={styles.heroTitle}>My Documents</Text>
            <Text style={styles.heroSubtitle}>
              Kelola dokumen credential digital secara modular dan tersimpan
              lokal di wallet.
            </Text>
          </View>

          <View style={styles.heroIcon}>
            <Ionicons name="wallet-outline" size={36} color="#2563EB" />
          </View>
        </LinearGradient>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIconBlue}>
              <Ionicons
                name="folder-open-outline"
                size={24}
                color="#2563EB"
              />
            </View>

            <Text style={styles.statNumber}>
              {loadingDocs ? '-' : documents.length}
            </Text>

            <Text style={styles.statLabel}>Documents</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconOrange}>
              <Ionicons name="list-outline" size={24} color="#F97316" />
            </View>

            <Text style={styles.statNumber}>
              {loadingDocs ? '-' : totalAttributes}
            </Text>

            <Text style={styles.statLabel}>Attributes</Text>
          </View>
        </View>

        <View style={styles.actionCard}>
          <Text style={styles.sectionTitle}>Kelola Credential</Text>

          <Text style={styles.actionDescription}>
            Tambahkan credential secara manual atau terima credential dari QR
            issuer. Credential yang diterima akan tampil sebagai dokumen di
            wallet.
          </Text>

          <AnimatedButton
            style={styles.addCredentialButton}
            onPress={handleAddCredential}
            disabled={loading}
          >
            <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Tambah Credential</Text>
          </AnimatedButton>

          <AnimatedButton
            style={styles.scanQRButton}
            onPress={handleScanQR}
            disabled={loading}
          >
            <Ionicons name="scan-outline" size={20} color="#2563EB" />
            <Text style={styles.scanQRButtonText}>Scan QR Credential</Text>
          </AnimatedButton>
        </View>

        {loadingDocs ? (
          <View style={styles.listSection}>
            {[1, 2].map((item) => (
              <View key={item} style={styles.parentCredentialCard}>
                <View style={styles.parentCredentialHeader}>
                  <View style={styles.parentCredentialLeft}>
                    <SkeletonBox width={50} height={50} borderRadius={16} />

                    <View style={styles.flexContent}>
                      <SkeletonBox width="70%" height={17} />
                      <SkeletonBox
                        width="55%"
                        height={12}
                        style={{ marginTop: 8 }}
                      />
                    </View>
                  </View>

                  <SkeletonBox width={56} height={24} borderRadius={999} />
                </View>

                <View style={styles.parentCredentialFooter}>
                  <SkeletonBox width="65%" height={12} />
                  <SkeletonBox width={16} height={16} borderRadius={8} />
                </View>
              </View>
            ))}
          </View>
        ) : documents.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="folder-open-outline" size={44} color="#2563EB" />
            </View>

            <Text style={styles.emptyTitle}>Belum Ada Dokumen</Text>

            <Text style={styles.emptyText}>
              Wallet belum memiliki credential. Gunakan Tambah Credential atau
              Scan QR Credential untuk menambahkan credential ke wallet.
            </Text>
          </View>
        ) : (
          <View style={styles.listSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Document List</Text>
              <Text style={styles.countText}>{documents.length} documents</Text>
            </View>

            {documents.map((doc) => {
              const isDeleting = deletingDocumentId === doc.documentId;
              const status = getCredentialStatus(doc);
              const isValid = status.status === 'VALID';

              return (
                <View key={doc.documentId} style={styles.documentCardWrapper}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.parentCredentialCard,
                      pressed && styles.parentCredentialCardPressed,
                      isDeleting && styles.disabledCard,
                    ]}
                    onPress={() => {
                      void handleOpenDocument(doc);
                    }}
                    disabled={isDeleting}
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

                        <View style={styles.flexContent}>
                          <Text
                            style={styles.parentCredentialTitle}
                            numberOfLines={1}
                          >
                            {getDocumentDisplayName(doc)}
                          </Text>

                          <Text
                            style={styles.parentCredentialIssuer}
                            numberOfLines={1}
                          >
                            {getCredentialIssuerText(doc)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.parentRightColumn}>
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

                        <Pressable
                          style={({ pressed }) => [
                            styles.deleteMiniButton,
                            pressed && styles.deleteMiniButtonPressed,
                            isDeleting && styles.deleteIconButtonDisabled,
                          ]}
                          onPress={(event) => {
                            event.stopPropagation();
                            void handleDeleteDocument(doc);
                          }}
                          disabled={loading || isDeleting}
                        >
                          <Ionicons
                            name={
                              isDeleting ? 'hourglass-outline' : 'trash-outline'
                            }
                            size={16}
                            color="#DC2626"
                          />
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.parentCredentialFooter}>
                      <Text style={styles.parentCredentialHint}>
                        Klik untuk melihat detail credential
                      </Text>

                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color="#94A3B8"
                      />
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={22} color="#2563EB" />
          <Text style={styles.noteText}>
            Dalam prinsip SSI, credential idealnya diterbitkan oleh issuer resmi.
            Wallet berperan untuk menerima, menyimpan, menampilkan, dan
            membuktikan credential.
          </Text>
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
  screen: {
    flex: 1,
  },
  flexContent: {
    flex: 1,
  },
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
  actionDescription: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 8,
  },
  addCredentialButton: {
    backgroundColor: '#2563EB',
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  scanQRButton: {
    backgroundColor: '#EFF6FF',
    marginTop: 12,
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  scanQRButtonText: {
    color: '#2563EB',
    fontWeight: '900',
    fontSize: 13,
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
  documentCardWrapper: {
    marginBottom: 12,
  },
  parentCredentialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  parentCredentialCardPressed: {
    backgroundColor: '#F8FAFC',
    borderColor: '#2563EB',
    transform: [{ scale: 0.99 }],
  },
  disabledCard: {
    opacity: 0.65,
  },
  parentCredentialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  parentCredentialLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  parentCredentialIconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentCredentialTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },
  parentCredentialIssuer: {
    marginTop: 5,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  parentRightColumn: {
    alignItems: 'flex-end',
    gap: 8,
  },
  parentStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  parentStatusValid: {
    backgroundColor: '#DCFCE7',
  },
  parentStatusExpired: {
    backgroundColor: '#FEE2E2',
  },
  parentStatusText: {
    fontSize: 10,
    fontWeight: '900',
  },
  parentStatusTextValid: {
    color: '#166534',
  },
  parentStatusTextExpired: {
    color: '#991B1B',
  },
  deleteMiniButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteMiniButtonPressed: {
    backgroundColor: '#FEE2E2',
    transform: [{ scale: 0.96 }],
  },
  deleteIconButtonDisabled: {
    opacity: 0.55,
  },
  parentCredentialFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  parentCredentialHint: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
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