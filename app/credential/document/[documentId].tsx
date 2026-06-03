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
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';

import { CredentialDocument, ModularCredential } from '../../../src/types/vc';
import { getCredentialDocumentById } from '../../../src/Services/documentCredentialService';
import { getDID } from '../../../src/Storage/didStorage';
import {
  createSignedPresentationJWT,
  SignedPresentationJWT,
} from '../../../src/Services/presentationService';
import { checkCredentialExpiration } from '../../../src/Services/credentialValidityService';
import { validatePresentationPayloadSize } from '../../../src/Services/qrPayloadService';
import { isJwtString } from '../../../src/Services/walletJwtSigner';

import AnimatedButton from '../../../components/ui/AnimatedButton';
import AppToast from '../../../components/ui/AppToast';
import LoadingOverlay from '../../../components/ui/LoadingOverlay';

type SelectedAttributeMap = Record<string, boolean>;

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

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '-'}</Text>
    </View>
  );
}

export default function CredentialDocumentDetailScreen() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const router = useRouter();

  const [document, setDocument] = useState<CredentialDocument | null>(null);
  const [selectedAttributes, setSelectedAttributes] = useState<SelectedAttributeMap>({});
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

  const credentials = document?.credentials ?? [];

  const mainCredential = useMemo(() => {
    if (!document) return null;

    return getMainCredential(document);
  }, [document]);

  const selectedCredentials = useMemo(
    () => credentials.filter((credential) => selectedAttributes[credential.id]),
    [credentials, selectedAttributes]
  );

  const qrJwt = presentationJwt.trim();
  const qrJwtParts = qrJwt ? qrJwt.split('.').length : 0;
  const isPresentationJwtValid =
    Boolean(qrJwt) && isJwtString(qrJwt) && qrJwtParts === 3;

  const loadDocument = useCallback(async () => {
    try {
      if (!documentId) {
        Alert.alert('Error', 'ID dokumen credential tidak valid');
        router.back();
        return;
      }

      setLoading(true);

      const data = await getCredentialDocumentById(documentId);

      if (!data) {
        Alert.alert('Tidak ditemukan', 'Dokumen credential tidak ditemukan');
        router.back();
        return;
      }

      const defaultSelected: SelectedAttributeMap = {};

      for (const credential of data.credentials ?? []) {
        defaultSelected[credential.id] = isCredentialPresentable(credential);
      }

      setDocument(data);
      setSelectedAttributes(defaultSelected);
      setPresentationJwt('');
      setPresentationMeta(null);
      setQrWarning('');
    } catch {
      Alert.alert('Error', 'Gagal mengambil detail dokumen credential');
    } finally {
      setLoading(false);
    }
  }, [documentId, router]);

  useEffect(() => {
    void loadDocument();
  }, [loadDocument]);

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

  function handleToggleAttribute(attributeId: string) {
    resetPresentation();

    const target = credentials.find((credential) => credential.id === attributeId);

    if (!target) {
      showToast('Credential tidak ditemukan.', 'error');
      return;
    }

    if (!isCredentialPresentable(target)) {
      showToast(getCredentialBlockedReason(target), 'error');
      return;
    }

    setSelectedAttributes((current) => ({
      ...current,
      [attributeId]: !current[attributeId],
    }));
  }

  function selectAll() {
    resetPresentation();

    const nextSelected: SelectedAttributeMap = {};

    for (const credential of credentials) {
      nextSelected[credential.id] = isCredentialPresentable(credential);
    }

    setSelectedAttributes(nextSelected);

    const selectedCount = Object.values(nextSelected).filter(Boolean).length;

    if (selectedCount === 0) {
      showToast(
        'Tidak ada atribut yang bisa dipresentasikan. Pastikan credential punya VC JWT valid.',
        'error'
      );
    }
  }

  function clearSelection() {
    resetPresentation();

    const nextSelected: SelectedAttributeMap = {};

    for (const credential of credentials) {
      nextSelected[credential.id] = false;
    }

    setSelectedAttributes(nextSelected);
  }

  async function handleConfirmAndSignPresentation() {
    try {
      if (!document) {
        showToast('Dokumen credential tidak ditemukan.', 'error');
        return;
      }

      if (selectedCredentials.length === 0) {
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

      const invalidCredential = selectedCredentials.find(
        (credential) => !isCredentialPresentable(credential)
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
        error instanceof Error ? error.message : 'Gagal membuat signed VP JWT.';

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

  if (!document || !mainCredential) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="hourglass-outline" size={36} color="#2563EB" />
        <Text style={styles.loadingText}>Memuat detail credential...</Text>
        <LoadingOverlay visible={loading} message="Memuat detail credential..." />
      </View>
    );
  }

  const status = getMainCredentialStatus(document);
  const isValid = status.status === 'VALID';
  const selectedCount = selectedCredentials.length;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={20} color="#111827" />
          <Text style={styles.backText}>Kembali</Text>
        </Pressable>

        <View style={styles.headerCard}>
          <View style={styles.documentIcon}>
            <Ionicons
              name={getDocumentIcon(document.documentType)}
              size={38}
              color="#2563EB"
            />
          </View>

          <Text style={styles.documentTitle}>{getDetailTitle(document)}</Text>
          <Text style={styles.documentSubtitle}>Credential Parent</Text>

          <View
            style={[
              styles.statusBadge,
              isValid ? styles.statusValid : styles.statusExpired,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isValid ? styles.statusTextValid : styles.statusTextExpired,
              ]}
            >
              {status.label}
            </Text>
          </View>

          <Text style={styles.issuerText} numberOfLines={2}>
            Issuer: {mainCredential.issuer ?? 'Unknown Issuer'}
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBlue}>
              <Ionicons name="document-text-outline" size={22} color="#2563EB" />
            </View>
            <Text style={styles.sectionTitle}>Credential Parent</Text>
          </View>

          <InfoItem label="Document ID" value={document.documentId} />
          <InfoItem label="Document Type" value={document.documentType} />
          <InfoItem label="Document Name" value={document.documentName} />
          <InfoItem label="Issuer" value={mainCredential.issuer} />
          <InfoItem label="Issuance Date" value={formatDate(mainCredential.issuanceDate)} />
          <InfoItem label="Expiration Date" value={formatDate(mainCredential.expirationDate)} />
          <InfoItem
            label="Credential Count"
            value={String(document.credentials?.length ?? 0)}
          />
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Daftar Atribut Credential</Text>
              <Text style={styles.smallText}>
                Dipilih: {selectedCount} dari {credentials.length}
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

          {credentials.map((credential) => {
            const enabled = Boolean(selectedAttributes[credential.id]);
            const presentable = isCredentialPresentable(credential);
            const statusLabel = getCredentialStatusLabel(credential);

            return (
              <Pressable
                key={credential.id}
                style={[
                  styles.attributeRow,
                  enabled && styles.attributeRowActive,
                  !presentable && styles.attributeRowDisabled,
                ]}
                onPress={() => handleToggleAttribute(credential.id)}
              >
                <View style={[styles.checkCircle, enabled && styles.checkCircleActive]}>
                  {enabled && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.attributeName, enabled && styles.attributeNameActive]}>
                    {credential.credentialSubject.attributeName}
                  </Text>

                  <Text style={[styles.attributeValue, enabled && styles.attributeValueActive]}>
                    {credential.credentialSubject.attributeValue || '-'}
                  </Text>

                  <Text style={[styles.attributeMeta, enabled && styles.attributeMetaActive]}>
                    Type: {credential.credentialSubject.attributeType} • Issuer: {shorten(credential.issuer)}
                  </Text>

                  <Text
                    style={[
                      styles.attributeStatus,
                      enabled && styles.attributeStatusActive,
                      !presentable && styles.attributeStatusBlocked,
                    ]}
                  >
                    Status: {statusLabel}
                  </Text>
                </View>

                <Ionicons
                  name={enabled ? 'eye-outline' : 'eye-off-outline'}
                  size={22}
                  color={enabled ? '#FFFFFF' : '#6B7280'}
                />
              </Pressable>
            );
          })}

          {selectedCredentials.length > 0 && (
            <View style={styles.previewBox}>
              <Text style={styles.previewTitle}>Preview Atribut Terpilih</Text>

              {selectedCredentials.map((credential) => (
                <View key={credential.id} style={styles.previewRow}>
                  <Text style={styles.previewLabel}>
                    {credential.credentialSubject.attributeName}
                  </Text>
                  <Text style={styles.previewValue}>
                    {credential.credentialSubject.attributeValue || '-'}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <AnimatedButton
            style={[
              styles.presentButton,
              selectedCredentials.length === 0 && styles.disabledButton,
            ]}
            disabled={selectedCredentials.length === 0}
            onPress={handleConfirmAndSignPresentation}
          >
            <Ionicons name="create-outline" size={22} color="#FFFFFF" />
            <Text style={styles.presentButtonText}>Confirm & Sign Presentation</Text>
          </AnimatedButton>
        </View>

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
                    Credential Count:{' '}
                    {presentationMeta?.credentialCount || selectedCredentials.length}
                  </Text>
                </View>

                <Text style={styles.verifyOnlyText}>SCAN QR INI DI TAB VERIFY</Text>

                <View style={styles.qrBox}>
                  <QRCode value={qrJwt} size={220} />
                </View>

                <Text style={styles.qrNote}>
                  QR ini berisi VP JWT murni dengan format header.payload.signature.
                  QR ini hanya muncul setelah Confirm & Sign Presentation berhasil.
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

          {getCredentialJwt(mainCredential) ? (
            <>
              <InfoItem label="Proof Type" value="JwtProof2020" />
              <InfoItem label="Verification Method" value={mainCredential.issuer || '-'} />

              <Text style={styles.infoLabel}>VC JWT</Text>
              <Text style={styles.jwtText}>{getCredentialJwt(mainCredential)}</Text>
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

function isCredentialPresentable(credential: ModularCredential): boolean {
  const expiration = checkCredentialExpiration(credential);

  if (expiration.isExpired || expiration.isNotYetValid) {
    return false;
  }

  if (!getCredentialJwt(credential)) {
    return false;
  }

  return !INVALID_PRESENTATION_STATUSES.includes(credential.verificationStatus ?? '');
}

function getCredentialStatusLabel(credential: ModularCredential): string {
  const expiration = checkCredentialExpiration(credential);

  if (!getCredentialJwt(credential)) return 'Tidak punya VC JWT';
  if (expiration.isExpired) return 'Expired';
  if (expiration.isNotYetValid) return 'Belum Berlaku';
  if (credential.verificationStatus === 'verified') return 'Verified JWT';

  return credential.verificationStatus || 'Pending Verification';
}

function getCredentialBlockedReason(credential: ModularCredential): string {
  const expiration = checkCredentialExpiration(credential);

  if (!getCredentialJwt(credential)) {
    return 'Credential ini tidak punya VC JWT. Buat ulang credential sebagai VC JWT valid.';
  }

  if (expiration.isExpired) {
    return 'Credential ini sudah expired.';
  }

  if (expiration.isNotYetValid) {
    return 'Credential ini belum berlaku.';
  }

  if (INVALID_PRESENTATION_STATUSES.includes(credential.verificationStatus ?? '')) {
    return 'Credential ini berstatus invalid dan tidak dapat dipresentasikan.';
  }

  return 'Credential ini tidak dapat dipresentasikan.';
}

function getDetailTitle(document: CredentialDocument) {
  if (document.documentType === 'KTP') return 'KTP (Kartu Tanda Penduduk)';
  if (document.documentType === 'KTM') return 'KTM (Kartu Tanda Mahasiswa)';
  if (document.documentType === 'SIM') return 'SIM (Surat Izin Mengemudi)';
  if (document.documentType === 'IJAZAH') return 'Ijazah Digital';

  return document.documentName || 'Credential Document';
}

function getDocumentIcon(documentType: string) {
  if (documentType === 'KTP') return 'id-card-outline';
  if (documentType === 'KTM') return 'school-outline';
  if (documentType === 'SIM') return 'car-outline';
  if (documentType === 'IJAZAH') return 'school-outline';

  return 'document-text-outline';
}

function getMainCredential(document: CredentialDocument) {
  const credentials = document.credentials ?? [];

  return (
    credentials.find(
      (vc) => vc.credentialSubject?.attributeType === 'legalName'
    ) ||
    credentials.find((vc) => vc.credentialSubject?.attributeType === 'nik') ||
    credentials.find(
      (vc) => vc.credentialSubject?.attributeType === 'studentId'
    ) ||
    credentials.find(
      (vc) => vc.credentialSubject?.attributeType === 'licenseNumber'
    ) ||
    credentials[0]
  );
}

function getMainCredentialStatus(document: CredentialDocument) {
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
    marginBottom: 22,
  },
  backText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  headerCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  documentIcon: {
    width: 82,
    height: 82,
    borderRadius: 24,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  documentTitle: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  documentSubtitle: {
    color: '#6B7280',
    fontWeight: '800',
    marginTop: 6,
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    marginTop: 12,
  },
  statusValid: {
    backgroundColor: '#DCFCE7',
  },
  statusExpired: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontWeight: '900',
    fontSize: 12,
  },
  statusTextValid: {
    color: '#166534',
  },
  statusTextExpired: {
    color: '#991B1B',
  },
  issuerText: {
    color: '#64748B',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 10,
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
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
  },
  infoItem: {
    marginBottom: 12,
  },
  infoLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  infoValue: {
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
  attributeRow: {
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
  attributeRowActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  attributeRowDisabled: {
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
  attributeName: {
    color: '#111827',
    fontWeight: '900',
    marginBottom: 4,
  },
  attributeNameActive: {
    color: '#FFFFFF',
  },
  attributeValue: {
    color: '#374151',
    fontWeight: '700',
    marginBottom: 4,
  },
  attributeValueActive: {
    color: '#E0F2FE',
  },
  attributeMeta: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
  },
  attributeMetaActive: {
    color: '#DBEAFE',
  },
  attributeStatus: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 4,
  },
  attributeStatusActive: {
    color: '#FFFFFF',
  },
  attributeStatusBlocked: {
    color: '#DC2626',
  },
  previewBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    marginTop: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewTitle: {
    color: '#111827',
    fontWeight: '900',
    marginBottom: 8,
  },
  previewRow: {
    paddingVertical: 8,
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
});