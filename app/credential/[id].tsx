import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';

import { ModularCredential } from '../../src/types/vc';
import {
  getAllVCs,
  getVCById,
  deleteVCById,
} from '../../src/Storage/vcStorage';
import { getDID } from '../../src/Storage/didStorage';
import {
  createSignedPresentationJWT,
  SignedPresentationJWT,
} from '../../src/Services/presentationService';
import { checkCredentialExpiration } from '../../src/Services/credentialValidityService';
import { validatePresentationPayloadSize } from '../../src/Services/qrPayloadService';
import { isJwtString } from '../../src/Services/walletJwtSigner';

import AnimatedButton from '../../components/ui/AnimatedButton';
import AppToast from '../../components/ui/AppToast';
import LoadingOverlay from '../../components/ui/LoadingOverlay';

type CredentialProof = {
  type?: string;
  proofPurpose?: string;
  verificationMethod?: string;
  jws?: string;
  jwt?: string;
  created?: string;
};

type ToastState = {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
};

const INVALID_PRESENTATION_STATUSES = [
  'invalid',
  'invalid_signature',
  'malformed_credential',
  'expired',
  'not_yet_valid',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getText(value: unknown, fallback = '-'): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function getProof(proof: unknown): CredentialProof | null {
  if (!isRecord(proof)) return null;

  return {
    type: getText(proof.type, ''),
    proofPurpose: getText(proof.proofPurpose, ''),
    verificationMethod: getText(proof.verificationMethod, ''),
    jws: getText(proof.jws, ''),
    jwt: getText(proof.jwt, ''),
    created: getText(proof.created, ''),
  };
}

function formatDate(value?: string): string {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function shorten(value?: string) {
  if (!value) return '-';
  if (value.length <= 24) return value;

  return `${value.slice(0, 14)}...${value.slice(-8)}`;
}

function getCredentialDisplayTitle(credential: ModularCredential): string {
  if (credential.documentName) return credential.documentName;
  if (credential.documentType) return `${credential.documentType} Credential`;

  const specificType = credential.type.find(
    (item) => item !== 'VerifiableCredential'
  );

  return specificType || 'Verifiable Credential';
}

function getCredentialJwt(credential: ModularCredential): string {
  const proof = credential.proof as any;

  if (isJwtString(credential.jwt)) {
    return credential.jwt.trim();
  }

  if (isJwtString(proof?.jwt)) {
    return proof.jwt.trim();
  }

  if (isJwtString(proof?.jws)) {
    return proof.jws.trim();
  }

  return '';
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || '-'}</Text>
    </View>
  );
}

export default function CredentialDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [credential, setCredential] = useState<ModularCredential | null>(null);
  const [documentCredentials, setDocumentCredentials] = useState<ModularCredential[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [presentationJwt, setPresentationJwt] = useState('');
  const [presentationMeta, setPresentationMeta] =
    useState<SignedPresentationJWT | null>(null);
  const [qrWarning, setQrWarning] = useState('');
  const [loading, setLoading] = useState(false);

  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: '',
    type: 'info',
  });

  const proof = useMemo(() => getProof(credential?.proof), [credential?.proof]);

  const qrJwt = presentationJwt.trim();
  const qrJwtParts = qrJwt ? qrJwt.split('.').length : 0;
  const isPresentationJwtValid =
    Boolean(qrJwt) && isJwtString(qrJwt) && qrJwtParts === 3;

  const selectedCredentials = useMemo(
    () => documentCredentials.filter((item) => selectedIds.includes(item.id)),
    [documentCredentials, selectedIds]
  );

  const loadCredential = useCallback(async () => {
    try {
      if (!id) return;

      setLoading(true);

      const data = await getVCById(id);

      if (!data) {
        Alert.alert('Tidak ditemukan', 'Credential tidak ditemukan');
        router.back();
        return;
      }

      const allCredentials = await getAllVCs();
      const sameDocumentCredentials = allCredentials.filter(
        (item) => item.documentId === data.documentId
      );

      setCredential(data);
      setDocumentCredentials(sameDocumentCredentials);
      setSelectedIds([]);
      setPresentationJwt('');
      setPresentationMeta(null);
      setQrWarning('');
    } catch {
      Alert.alert('Error', 'Gagal mengambil detail credential');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void loadCredential();
  }, [loadCredential]);

  function showToast(message: string, type: ToastState['type']) {
    setToast({
      visible: true,
      message,
      type,
    });
  }

  function resetPresentation() {
    setPresentationJwt('');
    setPresentationMeta(null);
    setQrWarning('');
  }

  function hasCredentialJwt(vc: ModularCredential): boolean {
    return Boolean(getCredentialJwt(vc));
  }

  function isCredentialPresentable(vc: ModularCredential): boolean {
    const expiration = checkCredentialExpiration(vc);

    if (expiration.isExpired || expiration.isNotYetValid) {
      return false;
    }

    if (!hasCredentialJwt(vc)) {
      return false;
    }

    return !INVALID_PRESENTATION_STATUSES.includes(vc.verificationStatus ?? '');
  }

  function getCredentialStatusLabel(vc: ModularCredential): string {
    const expiration = checkCredentialExpiration(vc);

    if (!hasCredentialJwt(vc)) return 'Tidak punya VC JWT';
    if (expiration.isExpired) return 'Expired';
    if (expiration.isNotYetValid) return 'Belum Berlaku';
    if (vc.verificationStatus === 'verified') return 'Verified JWT';

    return vc.verificationStatus || 'Pending Verification';
  }

  function getCredentialBlockedReason(vc: ModularCredential): string {
    const expiration = checkCredentialExpiration(vc);

    if (!hasCredentialJwt(vc)) {
      return 'Credential ini tidak punya VC JWT. Buat ulang credential sebagai VC JWT valid.';
    }

    if (expiration.isExpired) {
      return 'Credential ini sudah expired.';
    }

    if (expiration.isNotYetValid) {
      return 'Credential ini belum berlaku.';
    }

    if (INVALID_PRESENTATION_STATUSES.includes(vc.verificationStatus ?? '')) {
      return 'Credential ini berstatus invalid dan tidak dapat dipresentasikan.';
    }

    return 'Credential ini tidak dapat dipresentasikan.';
  }

  function toggleCredential(idValue: string) {
    resetPresentation();

    setSelectedIds((prev) => {
      if (prev.includes(idValue)) {
        return prev.filter((item) => item !== idValue);
      }

      return [...prev, idValue];
    });
  }

  function selectAll() {
    resetPresentation();

    const presentableIds = documentCredentials
      .filter(isCredentialPresentable)
      .map((item) => item.id);

    setSelectedIds(presentableIds);

    if (presentableIds.length === 0) {
      showToast(
        'Tidak ada credential yang bisa dipresentasikan. Pastikan credential punya VC JWT valid.',
        'error'
      );
    }
  }

  function clearSelection() {
    resetPresentation();
    setSelectedIds([]);
  }

  async function handleConfirmAndSignPresentation() {
    try {
      if (selectedIds.length === 0) {
        showToast('Pilih minimal 1 atribut untuk dipresentasikan.', 'error');
        return;
      }

      setLoading(true);
      resetPresentation();

      const didData = await getDID();

      if (!didData?.did) {
        showToast('DID belum tersedia.', 'error');
        return;
      }

      if (!didData.did.startsWith('did:key:')) {
        showToast('DID wallet harus menggunakan did:key.', 'error');
        return;
      }

      if (selectedCredentials.length === 0) {
        showToast('Credential terpilih tidak ditemukan.', 'error');
        return;
      }

      const invalidCredential = selectedCredentials.find(
        (item) => !isCredentialPresentable(item)
      );

      if (invalidCredential) {
        showToast(
          `Ada credential yang tidak dapat dipresentasikan. ${getCredentialBlockedReason(
            invalidCredential
          )}`,
          'error'
        );
        return;
      }

      const vp = await createSignedPresentationJWT({
        holderDid: didData.did,
        credentials: selectedCredentials,
      });

      const vpJwt = vp.jwt.trim();

      if (!vpJwt) {
        throw new Error('VP JWT kosong.');
      }

      if (!isJwtString(vpJwt) || vpJwt.split('.').length !== 3) {
        throw new Error('VP JWT hasil signing tidak valid.');
      }

      validatePresentationPayloadSize(vpJwt);

      if (vpJwt.length > 2500) {
        setQrWarning(
          'VP JWT cukup panjang. Jika QR sulit discan, kurangi jumlah atribut yang dipilih.'
        );
      }

      setPresentationJwt(vpJwt);
      setPresentationMeta(vp);

      showToast(
        `${vp.credentialCount} atribut berhasil ditandatangani sebagai VP JWT.`,
        'success'
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal membuat signed VP JWT.';

      setQrWarning(message);
      setPresentationJwt('');
      setPresentationMeta(null);

      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyJWT() {
    if (!isPresentationJwtValid) {
      showToast('VP JWT tidak valid sehingga tidak bisa disalin.', 'error');
      return;
    }

    await Clipboard.setStringAsync(qrJwt);

    showToast('VP JWT berhasil disalin.', 'success');
  }

  async function handleDeleteCredential() {
    if (!credential) return;

    Alert.alert(
      'Hapus Credential',
      'Credential ini akan dihapus dari wallet lokal. Lanjutkan?',
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
              await deleteVCById(credential.id);
              router.replace('/(tabs)');
            } catch {
              Alert.alert('Error', 'Gagal menghapus credential');
            }
          },
        },
      ]
    );
  }

  if (!credential) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="hourglass-outline" size={36} color="#2563EB" />
        <Text style={styles.loadingText}>Memuat credential...</Text>
        <LoadingOverlay visible={loading} message="Memuat credential..." />
      </View>
    );
  }

  const credentialTitle = getCredentialDisplayTitle(credential);
  const currentCredentialJwt = getCredentialJwt(credential);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={20} color="#111827" />
          <Text style={styles.backText}>Kembali</Text>
        </Pressable>

        <LinearGradient
          colors={['#2563EB', '#1D4ED8', '#F97316']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.heroLabel}>Credential Detail</Text>
            <Text style={styles.heroTitle}>{credentialTitle}</Text>
            <Text style={styles.heroSubtitle}>
              Pilih atribut, lalu klik Confirm & Sign Presentation untuk membuat QR VP JWT.
            </Text>
          </View>

          <View style={styles.heroIcon}>
            <Ionicons name="shield-checkmark-outline" size={36} color="#2563EB" />
          </View>
        </LinearGradient>

        <View style={styles.noticeCard}>
          <Ionicons name="information-circle-outline" size={24} color="#2563EB" />
          <Text style={styles.noticeText}>
            Tombol Tampilkan QR diganti menjadi Confirm & Sign Presentation.
            QR hanya muncul setelah VP JWT berhasil dibuat.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBlue}>
              <Ionicons name="document-text-outline" size={22} color="#2563EB" />
            </View>
            <Text style={styles.sectionTitle}>Credential Information</Text>
          </View>

          <InfoItem label="Credential ID" value={credential.id} />
          <InfoItem label="Document ID" value={credential.documentId} />
          <InfoItem label="Document Type" value={credential.documentType} />
          <InfoItem label="Document Name" value={credential.documentName} />
          <InfoItem label="Type" value={credential.type.join(', ')} />
          <InfoItem label="Issuer" value={credential.issuer} />
          <InfoItem label="Issuance Date" value={formatDate(credential.issuanceDate)} />
          <InfoItem label="Expiration Date" value={formatDate(credential.expirationDate)} />
          <InfoItem
            label="Verification Status"
            value={credential.verificationStatus ?? 'pending_verification'}
          />
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Pilih Atribut untuk Ditampilkan</Text>
              <Text style={styles.smallText}>
                Dipilih: {selectedIds.length} dari {documentCredentials.length}
              </Text>
            </View>

            <View style={styles.inlineActions}>
              <Pressable style={styles.smallButton} onPress={selectAll}>
                <Text style={styles.smallButtonText}>Semua</Text>
              </Pressable>

              <Pressable style={styles.smallButtonLight} onPress={clearSelection}>
                <Text style={styles.smallButtonLightText}>Reset</Text>
              </Pressable>
            </View>
          </View>

          {documentCredentials.map((item) => {
            const selected = selectedIds.includes(item.id);
            const presentable = isCredentialPresentable(item);
            const statusLabel = getCredentialStatusLabel(item);

            return (
              <Pressable
                key={item.id}
                style={[
                  styles.credentialOption,
                  selected && styles.credentialOptionActive,
                  !presentable && styles.credentialOptionDisabled,
                ]}
                onPress={() => {
                  if (!presentable) {
                    showToast(getCredentialBlockedReason(item), 'error');
                    return;
                  }

                  toggleCredential(item.id);
                }}
              >
                <View style={[styles.checkCircle, selected && styles.checkCircleActive]}>
                  {selected && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, selected && styles.optionTitleActive]}>
                    {item.credentialSubject.attributeName}
                  </Text>

                  <Text style={[styles.optionValue, selected && styles.optionValueActive]}>
                    {item.credentialSubject.attributeValue || '-'}
                  </Text>

                  <Text style={[styles.optionMeta, selected && styles.optionMetaActive]}>
                    Type: {item.credentialSubject.attributeType} • Issuer: {shorten(item.issuer)}
                  </Text>

                  <Text
                    style={[
                      styles.optionStatus,
                      selected && styles.optionStatusActive,
                      !presentable && styles.optionStatusBlocked,
                    ]}
                  >
                    Status: {statusLabel}
                  </Text>
                </View>

                <Ionicons
                  name={selected ? 'eye-outline' : 'eye-off-outline'}
                  size={22}
                  color={selected ? '#FFFFFF' : '#6B7280'}
                />
              </Pressable>
            );
          })}

          <AnimatedButton
            style={[
              styles.presentButton,
              selectedIds.length === 0 && styles.disabledButton,
            ]}
            disabled={selectedIds.length === 0}
            onPress={handleConfirmAndSignPresentation}
          >
            <Ionicons name="create-outline" size={22} color="#FFFFFF" />
            <Text style={styles.presentButtonText}>Confirm & Sign Presentation</Text>
          </AnimatedButton>
        </View>

        {selectedCredentials.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Preview Data yang Akan Ditampilkan</Text>

            {selectedCredentials.map((item) => (
              <View key={item.id} style={styles.previewRow}>
                <Text style={styles.previewLabel}>
                  {item.credentialSubject.attributeName}
                </Text>
                <Text style={styles.previewValue}>
                  {item.credentialSubject.attributeValue || '-'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {qrWarning ? (
          <View style={styles.warningCard}>
            <Ionicons name="warning-outline" size={22} color="#F97316" />
            <Text style={styles.warningText}>{qrWarning}</Text>
          </View>
        ) : null}

        {presentationJwt ? (
          isPresentationJwtValid ? (
            <>
              <View style={styles.qrCard}>
                <Text style={styles.qrTitle}>Signed QR Presentation</Text>

                <View style={styles.qrStatusBox}>
                  <Text style={styles.qrStatusText}>Status: VP JWT Valid</Text>
                  <Text style={styles.qrStatusText}>JWT Parts: {qrJwtParts}</Text>
                  <Text style={styles.qrStatusText}>
                    Credential Count: {presentationMeta?.credentialCount || selectedCredentials.length}
                  </Text>
                </View>

                <Text style={styles.verifyOnlyText}>SCAN QR INI DI TAB VERIFY</Text>

                <View style={styles.qrBox}>
                  <QRCode value={qrJwt} size={220} />
                </View>

                <Text style={styles.qrNote}>
                  QR ini berisi VP JWT murni dengan format header.payload.signature.
                  QR ini dibuat setelah Confirm & Sign Presentation.
                </Text>

                <Text style={styles.jwtLabel}>Preview VP JWT</Text>
                <Text style={styles.jwtPreview} numberOfLines={4}>
                  {qrJwt}
                </Text>
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.jwtHeader}>
                  <Text style={styles.sectionTitle}>VP JWT Lengkap</Text>

                  <AnimatedButton style={styles.copyButton} onPress={handleCopyJWT}>
                    <Ionicons name="copy-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.copyButtonText}>Copy JWT</Text>
                  </AnimatedButton>
                </View>

                <Text style={styles.jwtText}>{qrJwt}</Text>
              </View>
            </>
          ) : (
            <View style={styles.warningCard}>
              <Ionicons name="close-circle-outline" size={22} color="#DC2626" />
              <Text style={styles.warningText}>
                VP JWT tidak valid sehingga QR tidak ditampilkan. Silakan buat ulang presentation.
              </Text>
            </View>
          )
        ) : null}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBlue}>
              <Ionicons name="key-outline" size={22} color="#2563EB" />
            </View>
            <Text style={styles.sectionTitle}>Proof VC JWT</Text>
          </View>

          {currentCredentialJwt ? (
            <>
              <InfoItem label="Proof Type" value={proof?.type || 'JwtProof2020'} />
              <InfoItem label="Created" value={proof?.created || '-'} />
              <InfoItem label="Proof Purpose" value={proof?.proofPurpose || 'assertionMethod'} />
              <InfoItem
                label="Verification Method"
                value={proof?.verificationMethod || credential.issuer || '-'}
              />

              <Text style={styles.label}>VC JWT</Text>
              <Text style={styles.signatureText}>{currentCredentialJwt}</Text>
            </>
          ) : (
            <View style={styles.emptyProof}>
              <Ionicons name="warning-outline" size={26} color="#F97316" />
              <Text style={styles.emptyProofText}>
                Credential belum memiliki VC JWT. Credential lama perlu dibuat ulang agar bisa dipresentasikan sebagai VP JWT.
              </Text>
            </View>
          )}
        </View>

        <AnimatedButton style={styles.deleteButton} onPress={handleDeleteCredential}>
          <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
          <Text style={styles.deleteButtonText}>Hapus Credential</Text>
        </AnimatedButton>

        <View style={styles.statusCard}>
          <Ionicons name="lock-closed-outline" size={22} color="#16A34A" />
          <Text style={styles.statusText}>Credential tersimpan lokal</Text>
        </View>
      </ScrollView>

      <LoadingOverlay visible={loading} message="Memproses..." />

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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '700',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  backText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  hero: {
    borderRadius: 28,
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 16,
  },
  heroLabel: {
    color: '#DBEAFE',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: '#E0F2FE',
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  noticeText: {
    color: '#1E3A8A',
    fontWeight: '800',
    flex: 1,
    lineHeight: 20,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 10,
  },
  sectionIconBlue: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },
  infoItem: {
    marginBottom: 12,
  },
  label: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  value: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  smallText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 8,
  },
  smallButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  smallButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  smallButtonLight: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  smallButtonLightText: {
    color: '#2563EB',
    fontWeight: '900',
    fontSize: 12,
  },
  credentialOption: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  credentialOptionActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  credentialOptionDisabled: {
    opacity: 0.55,
  },
  checkCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActive: {
    borderColor: '#FFFFFF',
    backgroundColor: '#1D4ED8',
  },
  optionTitle: {
    color: '#111827',
    fontWeight: '900',
    marginBottom: 4,
  },
  optionTitleActive: {
    color: '#FFFFFF',
  },
  optionValue: {
    color: '#374151',
    fontWeight: '700',
    marginBottom: 4,
  },
  optionValueActive: {
    color: '#E0F2FE',
  },
  optionMeta: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
  },
  optionMetaActive: {
    color: '#DBEAFE',
  },
  optionStatus: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 4,
  },
  optionStatusActive: {
    color: '#FFFFFF',
  },
  optionStatusBlocked: {
    color: '#DC2626',
  },
  presentButton: {
    backgroundColor: '#2563EB',
    borderRadius: 18,
    paddingVertical: 16,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  presentButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  previewRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  previewLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
  },
  previewValue: {
    color: '#111827',
    fontWeight: '800',
  },
  warningCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  warningText: {
    color: '#9A3412',
    fontWeight: '800',
    flex: 1,
    lineHeight: 20,
  },
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  qrTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
  },
  qrStatusBox: {
    alignSelf: 'stretch',
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  qrStatusText: {
    color: '#166534',
    fontWeight: '900',
    fontSize: 13,
    marginBottom: 2,
  },
  verifyOnlyText: {
    color: '#16A34A',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
    textAlign: 'center',
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  qrNote: {
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '700',
    marginTop: 14,
    lineHeight: 20,
  },
  jwtLabel: {
    alignSelf: 'stretch',
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 18,
    marginBottom: 6,
  },
  jwtPreview: {
    alignSelf: 'stretch',
    color: '#374151',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
  jwtHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  copyButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  jwtText: {
    color: '#374151',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 17,
  },
  signatureText: {
    color: '#374151',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 17,
  },
  emptyProof: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    gap: 8,
  },
  emptyProofText: {
    color: '#9A3412',
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 20,
  },
  deleteButton: {
    backgroundColor: '#DC2626',
    borderRadius: 18,
    paddingVertical: 16,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  statusCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  statusText: {
    color: '#166534',
    fontWeight: '900',
  },
});