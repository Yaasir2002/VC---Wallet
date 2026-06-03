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
import { getAllVCs, getVCById, deleteVC } from '../../src/Storage/vcStorage';
import { getDID } from '../../src/Storage/didStorage';
import { createSignedPresentationJWT } from '../../src/Services/presentationService';
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

function getCredentialDisplayTitle(credential: ModularCredential): string {
  if (credential.documentName) return credential.documentName;
  if (credential.documentType) return `${credential.documentType} Credential`;

  const specificType = credential.type.find(
    (item) => item !== 'VerifiableCredential'
  );

  return specificType || 'Verifiable Credential';
}

function shorten(value?: string) {
  if (!value) return '-';
  if (value.length <= 24) return value;

  return `${value.slice(0, 14)}...${value.slice(-8)}`;
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
  const [loading, setLoading] = useState(false);

  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'info',
  });

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
    } catch {
      Alert.alert('Error', 'Gagal mengambil detail credential');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void loadCredential();
  }, [loadCredential]);

  const proof = useMemo(() => getProof(credential?.proof), [credential?.proof]);

  function hasCredentialJwt(vc: ModularCredential): boolean {
    return isJwtString(vc.jwt) || isJwtString(vc.proof?.jwt);
  }

  function isCredentialPresentable(vc: ModularCredential): boolean {
    const expiration = checkCredentialExpiration(vc);

    if (expiration.isExpired || expiration.isNotYetValid) return false;

    if (!hasCredentialJwt(vc)) return false;

    return ![
      'invalid',
      'invalid_signature',
      'malformed_credential',
      'expired',
      'not_yet_valid',
    ].includes(vc.verificationStatus ?? '');
  }

  function getCredentialStatusLabel(vc: ModularCredential): string {
    const expiration = checkCredentialExpiration(vc);

    if (!hasCredentialJwt(vc)) return 'Tidak punya VC JWT';
    if (expiration.isExpired) return 'Expired';
    if (expiration.isNotYetValid) return 'Belum Berlaku';
    if (vc.verificationStatus === 'verified') return 'Verified JWT';

    return vc.verificationStatus || 'Pending Verification';
  }

  function toggleCredential(idValue: string) {
    setPresentationJwt('');

    setSelectedIds((prev) => {
      if (prev.includes(idValue)) {
        return prev.filter((item) => item !== idValue);
      }

      return [...prev, idValue];
    });
  }

  function selectAll() {
    setPresentationJwt('');
    setSelectedIds(
      documentCredentials.filter(isCredentialPresentable).map((item) => item.id)
    );
  }

  function clearSelection() {
    setPresentationJwt('');
    setSelectedIds([]);
  }

  async function handleConfirmAndSignPresentation() {
    try {
      if (selectedIds.length === 0) {
        setToast({
          visible: true,
          message: 'Pilih minimal 1 atribut untuk dipresentasikan.',
          type: 'error',
        });
        return;
      }

      setLoading(true);

      const didData = await getDID();

      if (!didData?.did) {
        setToast({
          visible: true,
          message: 'DID belum tersedia.',
          type: 'error',
        });
        return;
      }

      const selectedCredentials = documentCredentials.filter((item) =>
        selectedIds.includes(item.id)
      );

      const invalidCredential = selectedCredentials.find(
        (item) => !isCredentialPresentable(item)
      );

      if (invalidCredential) {
        setToast({
          visible: true,
          message:
            'Ada credential yang tidak punya VC JWT valid, expired, atau invalid. Hapus credential lama dan buat ulang.',
          type: 'error',
        });
        return;
      }

      const vp = await createSignedPresentationJWT({
        holderDid: didData.did,
        credentials: selectedCredentials,
      });

      const vpJwt = vp.jwt.trim();

      if (!isJwtString(vpJwt)) {
        throw new Error('VP JWT hasil signing tidak valid.');
      }

      validatePresentationPayloadSize(vpJwt);

      setPresentationJwt(vpJwt);

      setToast({
        visible: true,
        message: `${selectedCredentials.length} atribut berhasil ditandatangani sebagai VP JWT.`,
        type: 'success',
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal membuat signed VP JWT.';

      setToast({
        visible: true,
        message,
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyJWT() {
    if (!presentationJwt) return;

    await Clipboard.setStringAsync(presentationJwt.trim());

    setToast({
      visible: true,
      message: 'VP JWT berhasil disalin.',
      type: 'success',
    });
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
              await deleteVC(credential.id);
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
  const selectedCredentials = documentCredentials.filter((item) =>
    selectedIds.includes(item.id)
  );

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
          <View>
            <Text style={styles.heroLabel}>Credential Detail</Text>
            <Text style={styles.heroTitle}>{credentialTitle}</Text>
            <Text style={styles.heroSubtitle}>
              Pilih atribut yang ingin dipresentasikan, lalu tanda tangani sebagai VP JWT.
            </Text>
          </View>

          <View style={styles.heroIcon}>
            <Ionicons name="shield-checkmark-outline" size={36} color="#2563EB" />
          </View>
        </LinearGradient>

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
          <InfoItem label="Verification Status" value={credential.verificationStatus ?? 'pending_verification'} />
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
                    setToast({
                      visible: true,
                      message:
                        'Credential ini tidak dapat dipresentasikan. Pastikan credential dibuat ulang sebagai VC JWT valid.',
                      type: 'error',
                    });
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

        {presentationJwt ? (
          <>
            <View style={styles.qrCard}>
              <Text style={styles.qrTitle}>Signed QR Presentation</Text>

              <View style={styles.qrBox}>
                <QRCode value={presentationJwt.trim()} size={220} />
              </View>

              <Text style={styles.qrNote}>
                QR ini berisi VP JWT murni dengan format header.payload.signature.
                Scan QR ini dari tab Verify.
              </Text>

              <Text style={styles.jwtLabel}>VP JWT</Text>
              <Text style={styles.jwtPreview} numberOfLines={4}>
                {presentationJwt.trim()}
              </Text>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.jwtHeader}>
                <Text style={styles.sectionTitle}>VP JWT Lengkap</Text>

                <AnimatedButton style={styles.copyButton} onPress={handleCopyJWT}>
                  <Ionicons name="copy-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.copyButtonText}>Copy</Text>
                </AnimatedButton>
              </View>

              <Text style={styles.jwtText}>{presentationJwt.trim()}</Text>
            </View>
          </>
        ) : null}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBlue}>
              <Ionicons name="key-outline" size={22} color="#2563EB" />
            </View>
            <Text style={styles.sectionTitle}>Proof VC JWT</Text>
          </View>

          {proof ? (
            <>
              <InfoItem label="Proof Type" value={proof.type || '-'} />
              <InfoItem label="Created" value={proof.created || '-'} />
              <InfoItem label="Proof Purpose" value={proof.proofPurpose || '-'} />
              <InfoItem label="Verification Method" value={proof.verificationMethod || '-'} />

              <Text style={styles.label}>VC JWT</Text>
              <Text style={styles.signatureText}>
                {proof.jwt || credential.jwt || '-'}
              </Text>
            </>
          ) : (
            <View style={styles.emptyProof}>
              <Ionicons name="warning-outline" size={26} color="#F97316" />
              <Text style={styles.emptyProofText}>
                Credential belum memiliki proof.
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
  },
  heroLabel: {
    fontSize: 14,
    color: '#FFEDD5',
    fontWeight: '900',
  },
  heroTitle: {
    fontSize: 30,
    color: '#FFFFFF',
    fontWeight: '900',
    marginTop: 2,
    maxWidth: 230,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#DBEAFE',
    marginTop: 8,
    lineHeight: 21,
    maxWidth: 230,
  },
  heroIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  sectionHeaderBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionIconBlue: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '900',
  },
  smallText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
    marginTop: 4,
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 8,
  },
  smallButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
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
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  smallButtonLightText: {
    color: '#2563EB',
    fontWeight: '900',
    fontSize: 12,
  },
  credentialOption: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  credentialOptionActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  credentialOptionDisabled: {
    opacity: 0.55,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActive: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  optionTitle: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '900',
  },
  optionTitleActive: {
    color: '#FFFFFF',
  },
  optionValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '700',
    marginTop: 3,
  },
  optionValueActive: {
    color: '#DBEAFE',
  },
  optionMeta: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 5,
    fontWeight: '700',
  },
  optionMetaActive: {
    color: '#BFDBFE',
  },
  optionStatus: {
    fontSize: 11,
    color: '#C2410C',
    marginTop: 5,
    fontWeight: '900',
  },
  optionStatusActive: {
    color: '#FFEDD5',
  },
  optionStatusBlocked: {
    color: '#DC2626',
  },
  disabledButton: {
    opacity: 0.5,
  },
  previewRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },
  previewLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '900',
  },
  previewValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '800',
    marginTop: 4,
  },
  infoItem: {
    marginTop: 12,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '900',
  },
  value: {
    fontSize: 14,
    color: '#111827',
    marginTop: 5,
    lineHeight: 20,
    fontWeight: '600',
  },
  signatureText: {
    marginTop: 6,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 14,
    fontSize: 12,
    lineHeight: 18,
    color: '#2563EB',
    fontWeight: '700',
  },
  emptyProof: {
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emptyProofText: {
    color: '#9A3412',
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  presentButton: {
    backgroundColor: '#F97316',
    marginTop: 14,
    paddingVertical: 15,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  presentButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  qrCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  qrTitle: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '900',
    marginBottom: 14,
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  qrNote: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 12,
  },
  jwtLabel: {
    alignSelf: 'flex-start',
    color: '#111827',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 16,
  },
  jwtPreview: {
    alignSelf: 'stretch',
    backgroundColor: '#F8FAFC',
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    padding: 12,
    borderRadius: 14,
    marginTop: 6,
  },
  jwtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  copyButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  jwtText: {
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    color: '#2563EB',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    padding: 12,
    borderRadius: 14,
  },
  deleteButton: {
    backgroundColor: '#DC2626',
    marginTop: 12,
    paddingVertical: 15,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  statusCard: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 18,
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusText: {
    color: '#166534',
    fontWeight: '900',
    fontSize: 14,
  },
});