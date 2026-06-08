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
import { isJwtString } from '../../../src/Services/walletJwtSigner';
import { MAX_PRESENTATION_QR_BYTES } from '../../../src/config/securityLimits';

import AnimatedButton from '../../../components/ui/AnimatedButton';
import AppToast from '../../../components/ui/AppToast';
import LoadingOverlay from '../../../components/ui/LoadingOverlay';
import PresentationQrView from '../../../components/PresentationQrView';

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
    NIK: 'NIK',
    nik: 'NIK',
    'Tempat Lahir': 'Tempat Lahir',
    tempatLahir: 'Tempat Lahir',
    birthPlace: 'Tempat Lahir',
    'Tanggal Lahir': 'Tanggal Lahir',
    tanggalLahir: 'Tanggal Lahir',
    birthDate: 'Tanggal Lahir',
    'Jenis Kelamin': 'Jenis Kelamin',
    jenisKelamin: 'Jenis Kelamin',
    gender: 'Jenis Kelamin',
    Alamat: 'Alamat',
    alamat: 'Alamat',
    address: 'Alamat',
    'RT/RW': 'RT/RW',
    rtRw: 'RT/RW',
    'Kelurahan/Desa': 'Kelurahan/Desa',
    kelurahanDesa: 'Kelurahan/Desa',
    Kecamatan: 'Kecamatan',
    kecamatan: 'Kecamatan',
    Agama: 'Agama',
    agama: 'Agama',
    'Status Perkawinan': 'Status Perkawinan',
    statusPerkawinan: 'Status Perkawinan',
    maritalStatus: 'Status Perkawinan',
    Pekerjaan: 'Pekerjaan',
    pekerjaan: 'Pekerjaan',
    occupation: 'Pekerjaan',
    Kewarganegaraan: 'Kewarganegaraan',
    kewarganegaraan: 'Kewarganegaraan',
    citizenship: 'Kewarganegaraan',
    'Berlaku Hingga': 'Berlaku Hingga',
    berlakuHingga: 'Berlaku Hingga',
    validUntilText: 'Berlaku Hingga',
    'Nim ': 'NIM',
    Nim: 'NIM',
    nim: 'NIM',
  };

  return labels[key] || key;
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

  const qrJwt = presentationJwt.trim();
  const isPresentationJwtValid = isJwtString(qrJwt);

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

      setLoading(true);
      setQrWarning('');
      setPresentationJwt('');
      setPresentationMeta(null);

      const result = await createSignedPresentationJWT({
        credentials: [mainCredential],
      });

      if (!isJwtString(result.jwt)) {
        throw new Error('JWT hasil signing tidak valid.');
      }

      if (byteLength(result.jwt) > MAX_PRESENTATION_QR_BYTES) {
        throw new Error('Payload QR terlalu besar.');
      }

      setPresentationJwt(result.jwt);
      setPresentationMeta(result);
      showToast('Credential berhasil ditandatangani sebagai JWT.', 'success');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal membuat signed VP JWT.';

      setQrWarning(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyJWT() {
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
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBlue}>
              <Ionicons name="id-card-outline" size={22} color="#2563EB" />
            </View>
            <Text style={styles.sectionTitle}>Detail Data Credential</Text>
          </View>

          {detailItems.length > 0 ? (
            detailItems.map((item) => (
              <InfoItem key={item.key} label={item.label} value={item.value} />
            ))
          ) : (
            <Text style={styles.emptyText}>
              Tidak ada detail data credential yang dapat ditampilkan.
            </Text>
          )}

          <View style={styles.jwtActionCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.jwtActionTitle}>Credential JWT</Text>
              <Text style={styles.jwtActionSubtitle}>
                {credentialJwt
                  ? 'JWT credential tersedia dan bisa disalin.'
                  : 'JWT credential tidak tersedia.'}
              </Text>
            </View>

            <Pressable
              style={[
                styles.smallCopyButton,
                !credentialJwt ? styles.disabledButton : null,
              ]}
              onPress={handleCopyCredentialJWT}
              disabled={!credentialJwt}
            >
              <Ionicons name="copy-outline" size={16} color="#FFFFFF" />
              <Text style={styles.smallCopyButtonText}>Copy JWT</Text>
            </Pressable>
          </View>

          <AnimatedButton
            style={styles.presentButton}
            onPress={handleConfirmAndSignPresentation}
          >
            <Ionicons name="create-outline" size={22} color="#FFFFFF" />
            <Text style={styles.presentButtonText}>Sign Presentation</Text>
          </AnimatedButton>
        </View>

        {qrWarning && !presentationJwt ? (
          <View style={styles.warningCard}>
            <Ionicons name="warning-outline" size={22} color="#F97316" />
            <Text style={styles.warningText}>{qrWarning}</Text>
          </View>
        ) : null}

        {presentationJwt ? (
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>Signed JWT QR</Text>

            <View style={styles.qrStatusBox}>
              <Text style={styles.qrStatusText}>Status: JWT Valid</Text>
              <Text style={styles.qrStatusText}>
                JWT Parts: {qrJwt.split('.').length}
              </Text>
              <Text style={styles.qrStatusText}>
                Credential Count: {presentationMeta?.credentialCount || 1}
              </Text>
              <Text style={styles.qrStatusText}>JWT Length: {qrJwt.length}</Text>
            </View>

            {canRenderQr ? (
              <View style={styles.qrBox}>
                <QRCode value={qrJwt} size={220} />
              </View>
            ) : (
              <View style={styles.warningCard}>
                <Ionicons name="warning-outline" size={22} color="#F97316" />
                <Text style={styles.warningText}>Payload QR terlalu besar.</Text>
              </View>
            )}

            <Text style={styles.qrNote}>
              QR ini berisi JWT compact: header.payload.signature.
            </Text>

            <Text style={styles.jwtLabel}>Preview JWT</Text>
            <Text style={styles.jwtPreview} numberOfLines={4}>
              {qrJwt}
            </Text>
          </View>
        ) : null}

        {presentationJwt ? (
          <View style={styles.sectionCard}>
            <View style={styles.jwtHeader}>
              <Text style={styles.sectionTitle}>JWT Lengkap</Text>

              <AnimatedButton style={styles.copyButton} onPress={handleCopyJWT}>
                <Ionicons name="copy-outline" size={16} color="#FFFFFF" />
                <Text style={styles.copyButtonText}>Copy JWT</Text>
              </AnimatedButton>
            </View>

            <Text style={styles.jwtText}>{qrJwt}</Text>
          </View>
        ) : null}
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

function getDetailTitle(document: CredentialDocument) {
  if (document.documentType === 'KTP') return 'KTP (Kartu Tanda Penduduk)';
  if (document.documentType === 'KTM') return 'KTM (Kartu Tanda Mahasiswa)';
  if (document.documentType === 'SIM') return 'SIM (Surat Izin Mengemudi)';
  if (document.documentType === 'IJAZAH') return 'Ijazah Digital';

  return document.documentName || 'Credential Document';
}

function getDocumentIcon(documentType: string): any {
  if (documentType === 'KTP') return 'id-card-outline';
  if (documentType === 'KTM') return 'school-outline';
  if (documentType === 'SIM') return 'car-outline';
  if (documentType === 'IJAZAH') return 'school-outline';

  return 'document-text-outline';
}

function getMainCredential(document: CredentialDocument): ModularCredential | null {
  const credentials = document.credentials ?? [];

  return (
    credentials.find((credential) => {
      const subject = credential.credentialSubject || {};

      return Boolean(subject.Nama || subject.nama || subject.NIK || subject.nik);
    }) ||
    credentials[0] ||
    null
  );
}

function getMainCredentialStatus(credential: ModularCredential) {
  if (
    credential.verificationStatus === 'signature_verified' ||
    credential.signatureVerified === true ||
    credential.metadata?.verificationStatus === 'signature_verified'
  ) {
    return { status: 'VALID', label: 'Signature Verified' };
  }

  const validUntil =
    credential.credentialSubject?.['Berlaku Hingga'] ||
    credential.credentialSubject?.berlakuHingga ||
    credential.credentialSubject?.validUntilText;

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
  const decodedCredential = isRecord(credential.decodedCredential)
    ? credential.decodedCredential
    : credential;

  const subject = isRecord(decodedCredential.credentialSubject)
    ? decodedCredential.credentialSubject
    : credential.credentialSubject || {};

  const items: DetailItem[] = [];

  const preferredOrder = [
    'Nama',
    'nama',
    'fullName',
    'NIK',
    'nik',
    'Tempat Lahir',
    'tempatLahir',
    'Tanggal Lahir',
    'tanggalLahir',
    'Jenis Kelamin',
    'jenisKelamin',
    'Alamat',
    'alamat',
    'RT/RW',
    'rtRw',
    'Kelurahan/Desa',
    'kelurahanDesa',
    'Kecamatan',
    'kecamatan',
    'Agama',
    'agama',
    'Status Perkawinan',
    'statusPerkawinan',
    'Pekerjaan',
    'pekerjaan',
    'Kewarganegaraan',
    'kewarganegaraan',
    'Berlaku Hingga',
    'berlakuHingga',
    'Nim ',
    'Nim',
    'nim',
  ];

  const ignoredKeys = new Set([
    'id',
    'documentId',
    'documentType',
    'documentName',
  ]);

  const addedLabels = new Set<string>();

  function pushItem(key: string, value: unknown) {
    if (ignoredKeys.has(key)) return;
    if (value === undefined || value === null || value === '') return;

    const label = normalizeLabel(key);

    if (addedLabels.has(label)) return;

    items.push({
      key,
      label,
      value: stringifyValue(value),
    });

    addedLabels.add(label);
  }

  for (const key of preferredOrder) {
    pushItem(key, subject[key]);
  }

  Object.entries(subject).forEach(([key, value]) => {
    pushItem(key, value);
  });

  if (items.length > 0) return items;

  return [
    {
      key: 'documentName',
      label: 'Nama Dokumen',
      value: document.documentName,
    },
    {
      key: 'documentType',
      label: 'Jenis Dokumen',
      value: document.documentType,
    },
  ];
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
    fontSize: 22,
    color: '#111827',
    fontWeight: '900',
    textAlign: 'center',
  },
  documentSubtitle: {
    marginTop: 6,
    color: '#64748B',
    fontSize: 13,
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
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionIconBlue: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconGreen: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flex: 1,
    fontSize: 17,
    color: '#111827',
    fontWeight: '900',
  },
  infoItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  infoValue: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
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
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  qrNote: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
  jwtLabel: {
    color: '#111827',
    fontWeight: '900',
    fontSize: 13,
    marginTop: 14,
    alignSelf: 'stretch',
  },
  jwtPreview: {
    color: '#334155',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
    alignSelf: 'stretch',
  },
  jwtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  copyButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  jwtText: {
    color: '#334155',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  warningText: {
    flex: 1,
    color: '#C2410C',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
});