// File: app/credential/document/[documentId].tsx

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
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

import { CredentialDocument, ModularCredential } from '../../../src/types/vc';
import { getCredentialDocumentById } from '../../../src/Services/documentCredentialService';
import {
  createSignedPresentationJWT,
  SignedPresentationJWT,
} from '../../../src/Services/presentationService';
import { getDID } from '../../../src/Storage/didStorage';
import { getDocumentIcon } from '../../../src/utils/credentialUtils';

import AnimatedButton from '../../../components/ui/AnimatedButton';
import AppToast from '../../../components/ui/AppToast';
import LoadingOverlay from '../../../components/ui/LoadingOverlay';

type ToastState = {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
};

type DetailItem = {
  key: string;
  label: string;
  value: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isJwtString(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const trimmed = value.trim();
  const parts = trimmed.split('.');

  return (
    trimmed.length > 0 &&
    parts.length === 3 &&
    parts.every((part) => part.trim().length > 0)
  );
}

function base64UrlDecodeToString(value: string): string {
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/');

  while (base64.length % 4) {
    base64 += '=';
  }

  const decoded = atob(base64);

  try {
    return decodeURIComponent(
      decoded
        .split('')
        .map((char) => `%${('00' + char.charCodeAt(0).toString(16)).slice(-2)}`)
        .join('')
    );
  } catch {
    return decoded;
  }
}

function decodeJwtHeaderForDebug(jwt: string): string {
  try {
    if (!isJwtString(jwt)) return '-';

    const [encodedHeader] = jwt.trim().split('.');
    const header = JSON.parse(base64UrlDecodeToString(encodedHeader));

    return JSON.stringify(header, null, 2);
  } catch {
    return '-';
  }
}

function getJwtHeaderKidForDebug(jwt: string): string {
  try {
    if (!isJwtString(jwt)) return '-';

    const [encodedHeader] = jwt.trim().split('.');
    const header = JSON.parse(base64UrlDecodeToString(encodedHeader));

    return typeof header?.kid === 'string' && header.kid.trim()
      ? header.kid.trim()
      : 'KID BELUM ADA';
  } catch {
    return '-';
  }
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return '-';
  }
}

function getIssuerText(issuer: unknown): string {
  if (!issuer) return 'Unknown Issuer';
  if (typeof issuer === 'string') return issuer;

  if (isRecord(issuer)) {
    if (typeof issuer.name === 'string') return issuer.name;
    if (typeof issuer.id === 'string') return issuer.id;
  }

  return 'Unknown Issuer';
}

function normalizeLabel(key: string): string {
  const labels: Record<string, string> = {
    Nama: 'Nama',
    nama: 'Nama',
    fullName: 'Nama',
    attributeName: 'Nama Atribut',
    attributeValue: 'Nilai Atribut',
    attributeType: 'Tipe Atribut',
    NIK: 'NIK',
    nik: 'NIK',
    NIM: 'NIM',
    Nim: 'NIM',
    nim: 'NIM',
    studentId: 'NIM',
    Prodi: 'Prodi',
    prodi: 'Prodi',
    Angkatan: 'Angkatan',
    'Angkatan ': 'Angkatan',
    Alamat: 'Alamat',
    alamat: 'Alamat',
    documentId: 'Document ID',
    documentType: 'Document Type',
    documentName: 'Document Name',
    birthDate: 'Tanggal Lahir',
    tanggalLahir: 'Tanggal Lahir',
    address: 'Alamat',
    validUntilText: 'Berlaku Hingga',
    berlakuHingga: 'Berlaku Hingga',
  };

  return labels[key] || key;
}

function shortenJwt(jwt: string): string {
  const normalized = jwt.trim();

  if (normalized.length <= 90) {
    return normalized;
  }

  return `${normalized.slice(0, 42)}...${normalized.slice(-28)}`;
}

function getCredentialJwtFromStoredCredential(
  credential: ModularCredential | null | undefined
): string | null {
  if (!credential) return null;

  const proofJwt =
    isRecord(credential.proof) && typeof credential.proof.jwt === 'string'
      ? credential.proof.jwt
      : null;

  const candidates = [
    credential.vcJwt,
    credential.rawJwt,
    credential.jwt,
    credential.securedCredential,
    proofJwt,
  ];

  const jwt = candidates.find((value) => isJwtString(value));

  return typeof jwt === 'string' ? jwt.trim() : null;
}

function getMainCredential(document: CredentialDocument): ModularCredential | null {
  if (Array.isArray(document.credentials) && document.credentials.length > 0) {
    return document.credentials[0];
  }

  return null;
}

function getDetailTitle(document: CredentialDocument): string {
  if (document.documentName) return document.documentName;

  if (document.documentType === 'KTP') return 'KTP (Kartu Tanda Penduduk)';
  if (document.documentType === 'KTM') return 'KTM (Kartu Tanda Mahasiswa)';
  if (document.documentType === 'SIM') return 'SIM (Surat Izin Mengemudi)';
  if (document.documentType === 'IJAZAH') return 'Ijazah Digital';

  return 'Credential Document';
}

function getMainCredentialStatus(credential: ModularCredential) {
  if (
    credential.verificationStatus === 'signature_verified' ||
    credential.signatureVerified === true ||
    credential.metadata?.verificationStatus === 'signature_verified'
  ) {
    return { status: 'VALID', label: 'VALID' };
  }

  const validUntil =
    credential.credentialSubject?.['Berlaku Hingga'] ||
    credential.credentialSubject?.berlakuHingga ||
    credential.credentialSubject?.validUntilText ||
    credential.validUntil ||
    credential.expirationDate;

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

function buildCredentialDetailItems(
  document: CredentialDocument,
  credential: ModularCredential
): DetailItem[] {
  const subject = credential.credentialSubject || {};
  const hiddenKeys = new Set(['id']);

  const subjectItems = Object.entries(subject)
    .filter(([key]) => !hiddenKeys.has(key))
    .map(([key, value]) => ({
      key,
      label: normalizeLabel(key),
      value: stringifyValue(value),
    }))
    .filter((item) => item.value !== '-');

  const baseItems: DetailItem[] = [
    {
      key: 'documentId',
      label: 'Document ID',
      value: document.documentId || credential.documentId || credential.id || '-',
    },
    {
      key: 'documentType',
      label: 'Document Type',
      value: document.documentType || credential.documentType || '-',
    },
    {
      key: 'issuer',
      label: 'Issuer',
      value: getIssuerText(credential.issuer),
    },
    {
      key: 'issuanceDate',
      label: 'Issuance Date',
      value: stringifyValue(credential.issuanceDate),
    },
  ];

  if (credential.expirationDate || credential.validUntil) {
    baseItems.push({
      key: 'expirationDate',
      label: 'Expiration Date',
      value: stringifyValue(credential.expirationDate || credential.validUntil),
    });
  }

  return [...baseItems, ...subjectItems];
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
  const [presentationJwt, setPresentationJwt] = useState('');
  const [presentationMeta, setPresentationMeta] =
    useState<SignedPresentationJWT | null>(null);
  const [qrWarning, setQrWarning] = useState('');
  const [loading, setLoading] = useState(false);
  const [showFullIssuerJwt, setShowFullIssuerJwt] = useState(false);
  const [showFullPresentationJwt, setShowFullPresentationJwt] = useState(false);

  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: '',
    type: 'info',
  });

  const mainCredential = useMemo(() => {
    if (!document) return null;
    return getMainCredential(document);
  }, [document]);

  const detailItems = useMemo(() => {
    if (!document || !mainCredential) return [];
    return buildCredentialDetailItems(document, mainCredential);
  }, [document, mainCredential]);

  const credentialJwt = useMemo(
    () => getCredentialJwtFromStoredCredential(mainCredential),
    [mainCredential]
  );

  const issuerSignatureVerified =
    mainCredential?.verificationStatus === 'signature_verified' ||
    mainCredential?.signatureVerified === true ||
    mainCredential?.metadata?.verificationStatus === 'signature_verified';

  const shouldShowIssuerJwtCard = Boolean(credentialJwt && issuerSignatureVerified);

  const issuerJwtPreview = credentialJwt
    ? showFullIssuerJwt
      ? credentialJwt
      : shortenJwt(credentialJwt)
    : '';

  const qrJwt = presentationJwt.trim();
  const isPresentationJwtValid = isJwtString(qrJwt);

  const presentationJwtPreview = isPresentationJwtValid
    ? showFullPresentationJwt
      ? qrJwt
      : shortenJwt(qrJwt)
    : '';

  const presentationHeaderDebug = isPresentationJwtValid
    ? decodeJwtHeaderForDebug(qrJwt)
    : '-';

  const presentationKidDebug = isPresentationJwtValid
    ? getJwtHeaderKidForDebug(qrJwt)
    : '-';

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

      setDocument(data);
      setPresentationJwt('');
      setPresentationMeta(null);
      setQrWarning('');
      setShowFullIssuerJwt(false);
      setShowFullPresentationJwt(false);
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

  async function handleConfirmAndSignPresentation() {
    try {
      if (!mainCredential) {
        showToast('Credential tidak ditemukan.', 'error');
        return;
      }

      const issuerJwt = getCredentialJwtFromStoredCredential(mainCredential);

      if (!issuerJwt) {
        showToast(
          'Raw VC JWT dari issuer tidak tersedia. Credential ini belum bisa dibuat menjadi VP JWT.',
          'error'
        );
        return;
      }

      const didData = await getDID();

      if (!didData?.did || !didData.did.startsWith('did:')) {
        showToast('Holder DID tidak ditemukan. Silakan buka ulang wallet.', 'error');
        return;
      }

      setLoading(true);
      setQrWarning('');
      setPresentationJwt('');
      setPresentationMeta(null);
      setShowFullPresentationJwt(false);

      const result = await createSignedPresentationJWT({
        holderDid: didData.did,
        credentials: [mainCredential],
      });

      if (!isJwtString(result.jwt)) {
        throw new Error('JWT hasil signing tidak valid.');
      }

      const signedJwt = result.jwt.trim();

      setPresentationJwt(signedJwt);
      setPresentationMeta(result);
      setQrWarning('');

      const kid = getJwtHeaderKidForDebug(signedJwt);

      if (kid === 'KID BELUM ADA') {
        showToast(
          'VP JWT berhasil dibuat, tetapi header kid belum ada. Cek walletJwtSigner.ts atau cache Metro.',
          'error'
        );
      } else {
        showToast('VP JWT berhasil ditandatangani dan siap dipindai.', 'success');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal membuat signed VP JWT.';

      setQrWarning(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyCredentialJWT() {
    if (!credentialJwt) {
      showToast('Issuer JWT Credential tidak tersedia.', 'error');
      return;
    }

    await Clipboard.setStringAsync(credentialJwt);
    showToast('Issuer JWT Credential berhasil disalin.', 'success');
  }

  async function handleCopyPresentationJWT() {
    if (!isPresentationJwtValid) {
      showToast('Signed VP JWT tidak valid sehingga tidak bisa disalin.', 'error');
      return;
    }

    await Clipboard.setStringAsync(qrJwt);
    showToast('Signed VP JWT berhasil disalin.', 'success');
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

  const status = getMainCredentialStatus(mainCredential);
  const isValid = issuerSignatureVerified || status.status === 'VALID';

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
          <Text style={styles.documentSubtitle}>
            {issuerSignatureVerified
              ? 'JWT VC Claim • Issuer Signature Verified'
              : 'Credential JSON VC v2'}
          </Text>

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
              {issuerSignatureVerified ? 'Signature Verified' : status.label}
            </Text>
          </View>

          <Text style={styles.issuerText} numberOfLines={2}>
            Issuer: {getIssuerText(mainCredential.issuer)}
          </Text>

          <Text style={styles.issuerText} numberOfLines={2}>
            Verification Status: {String(mainCredential.verificationStatus || '-')}
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Detail Credential</Text>

          {detailItems.map((item) => (
            <InfoItem key={item.key} label={item.label} value={item.value} />
          ))}
        </View>

        {shouldShowIssuerJwtCard ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Issuer VC JWT</Text>
                <Text style={styles.sectionSubtitle}>
                  JWT asli dari issuer yang akan dimasukkan ke VP JWT.
                </Text>
              </View>
            </View>

            <View style={styles.jwtBox}>
              <Text style={styles.jwtText} selectable>
                {issuerJwtPreview}
              </Text>
            </View>

            <View style={styles.rowActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setShowFullIssuerJwt((current) => !current)}
              >
                <Ionicons
                  name={showFullIssuerJwt ? 'contract-outline' : 'expand-outline'}
                  size={18}
                  color="#2563EB"
                />
                <Text style={styles.secondaryButtonText}>
                  {showFullIssuerJwt ? 'Ringkas' : 'Lihat Full'}
                </Text>
              </Pressable>

              <Pressable style={styles.secondaryButton} onPress={handleCopyCredentialJWT}>
                <Ionicons name="copy-outline" size={18} color="#2563EB" />
                <Text style={styles.secondaryButtonText}>Copy JWT</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Present Credential</Text>
          <Text style={styles.sectionSubtitle}>
            Buat Verifiable Presentation JWT dari credential ini agar dapat discan oleh verifier.
          </Text>

          <AnimatedButton
            style={styles.primaryButton}
            onPress={handleConfirmAndSignPresentation}
            disabled={loading}
          >
            <Ionicons name="qr-code-outline" size={22} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Buat Signed VP JWT</Text>
          </AnimatedButton>
        </View>

        {qrWarning ? (
          <View style={styles.warningCard}>
            <Ionicons name="warning-outline" size={22} color="#F97316" />
            <Text style={styles.warningText}>{qrWarning}</Text>
          </View>
        ) : null}

        {presentationJwt ? (
          <View style={styles.qrCard}>
            <Text style={styles.sectionTitle}>Signed VP JWT QR</Text>
            <Text style={styles.sectionSubtitle}>
              QR ini berisi Verifiable Presentation JWT yang sudah ditandatangani holder.
            </Text>

            <View style={styles.qrBox}>
              <QRCode value={qrJwt} size={230} />
            </View>

            <View style={styles.jwtBox}>
              <Text style={styles.jwtText} selectable>
                {presentationJwtPreview}
              </Text>
            </View>

            <View style={styles.metaBox}>
              <Text style={styles.metaText}>
                Holder DID: {presentationMeta?.holderDid || '-'}
              </Text>
              <Text style={styles.metaText}>
                Credential Count: {presentationMeta?.credentialCount || 1}
              </Text>
              <Text style={styles.metaText}>
                Algorithm: {presentationMeta?.algorithm || '-'}
              </Text>
              <Text style={styles.metaText}>Header KID: {presentationKidDebug}</Text>
              <Text style={styles.metaText}>Header Debug:</Text>
              <Text style={styles.debugText} selectable>
                {presentationHeaderDebug}
              </Text>
            </View>

            <View style={styles.rowActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() =>
                  setShowFullPresentationJwt((current) => !current)
                }
              >
                <Ionicons
                  name={showFullPresentationJwt ? 'contract-outline' : 'expand-outline'}
                  size={18}
                  color="#2563EB"
                />
                <Text style={styles.secondaryButtonText}>
                  {showFullPresentationJwt ? 'Ringkas' : 'Lihat Full'}
                </Text>
              </Pressable>

              <Pressable style={styles.secondaryButton} onPress={handleCopyPresentationJWT}>
                <Ionicons name="copy-outline" size={18} color="#2563EB" />
                <Text style={styles.secondaryButtonText}>Copy VP JWT</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <LoadingOverlay visible={loading} message="Memproses..." />

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
    paddingBottom: 42,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 18,
  },
  backText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    alignItems: 'center',
  },
  documentIcon: {
    width: 78,
    height: 78,
    borderRadius: 24,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  documentTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
  },
  documentSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
    fontWeight: '700',
    textAlign: 'center',
  },
  issuerText: {
    marginTop: 8,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  statusBadge: {
    marginTop: 14,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  statusValid: {
    backgroundColor: '#DCFCE7',
  },
  statusExpired: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '900',
  },
  statusTextValid: {
    color: '#166534',
  },
  statusTextExpired: {
    color: '#991B1B',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    lineHeight: 18,
  },
  infoItem: {
    marginTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  primaryButton: {
    marginTop: 18,
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  warningCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FED7AA',
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  warningText: {
    flex: 1,
    color: '#C2410C',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 16,
  },
  qrBox: {
    marginTop: 16,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  jwtBox: {
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
  },
  jwtText: {
    fontSize: 12,
    lineHeight: 20,
    color: '#111827',
    fontWeight: '800',
  },
  metaBox: {
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    padding: 14,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 19,
    color: '#475569',
    fontWeight: '800',
  },
  debugText: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 17,
    color: '#0F172A',
    fontWeight: '700',
  },
  rowActions: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: '#DBEAFE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  secondaryButtonText: {
    color: '#2563EB',
    fontWeight: '900',
    fontSize: 13,
  },
});