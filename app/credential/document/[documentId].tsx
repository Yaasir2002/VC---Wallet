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

const INVALID_PRESENTATION_STATUSES = [
  'invalid',
  'invalid_signature',
  'malformed_credential',
  'expired',
  'not_yet_valid',
];

const QR_SAFE_MAX_LENGTH = 2200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getCredentialJwt(credential: ModularCredential | null | undefined): string {
  if (!credential) return '';

  const proof = credential.proof as any;
  const rawCredential = (credential as any)?.rawCredential;

  const candidates = [
    credential.jwt,
    (credential as any)?.securedCredential,
    proof?.jwt,
    proof?.jws,
    (credential as any)?.vcJwt,
    rawCredential?.jwt,
    rawCredential?.securedCredential,
    rawCredential?.proof?.jwt,
  ];

  const found = candidates.find((candidate) => isJwtString(candidate));

  return found ? found.trim() : '';
}

function getIssuerText(issuer: unknown): string {
  if (!issuer) return 'Unknown Issuer';

  if (typeof issuer === 'string') {
    return issuer.trim() || 'Unknown Issuer';
  }

  if (typeof issuer === 'object' && issuer !== null) {
    const issuerRecord = issuer as Record<string, unknown>;

    if (typeof issuerRecord.name === 'string' && issuerRecord.name.trim()) {
      return issuerRecord.name;
    }

    if (typeof issuerRecord.id === 'string' && issuerRecord.id.trim()) {
      return issuerRecord.id;
    }
  }

  return 'Unknown Issuer';
}

function normalizeLabel(key: string): string {
  const labels: Record<string, string> = {
    nama: 'Nama Lengkap',
    fullName: 'Nama Lengkap',
    legalName: 'Nama Lengkap',
    nik: 'NIK',
    tempatLahir: 'Tempat Lahir',
    birthPlace: 'Tempat Lahir',
    tanggalLahir: 'Tanggal Lahir',
    birthDate: 'Tanggal Lahir',
    jenisKelamin: 'Jenis Kelamin',
    gender: 'Jenis Kelamin',
    alamat: 'Alamat',
    address: 'Alamat',
    agama: 'Agama',
    religion: 'Agama',
    statusPerkawinan: 'Status Perkawinan',
    maritalStatus: 'Status Perkawinan',
    pekerjaan: 'Pekerjaan',
    occupation: 'Pekerjaan',
    kewarganegaraan: 'Kewarganegaraan',
    citizenship: 'Kewarganegaraan',
    berlakuHingga: 'Berlaku Hingga',
    validUntilText: 'Berlaku Hingga',
    validUntil: 'Berlaku Hingga',
    studentId: 'NIM',
    university: 'Universitas',
    faculty: 'Fakultas',
    studyProgram: 'Program Studi',
    enrollmentYear: 'Tahun Masuk',
  };

  if (labels[key]) return labels[key];

  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
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
  const qrJwtParts = qrJwt ? qrJwt.split('.').length : 0;
  const isPresentationJwtValid =
    Boolean(qrJwt) && isJwtString(qrJwt) && qrJwtParts === 3;
  const canRenderQr =
    isPresentationJwtValid && qrJwt.length <= QR_SAFE_MAX_LENGTH;

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

  async function handleConfirmAndSignPresentation() {
    try {
      if (!document || !mainCredential) {
        showToast('Dokumen credential tidak ditemukan.', 'error');
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

      if (!isCredentialPresentable(mainCredential)) {
        showToast(getCredentialBlockedReason(mainCredential), 'error');
        return;
      }

      const vp = await createSignedPresentationJWT({
        holderDid: didData.did,
        credentials: [mainCredential],
      });

      const vpJwt = vp.jwt.trim();

      if (!vpJwt) {
        throw new Error('VP JWT kosong.');
      }

      if (!isJwtString(vpJwt) || vpJwt.split('.').length !== 3) {
        throw new Error('VP JWT hasil signing tidak valid.');
      }

      validatePresentationPayloadSize(vpJwt);

      if (vpJwt.length > QR_SAFE_MAX_LENGTH) {
        setQrWarning(
          'VP JWT terlalu panjang untuk QR Code. Gunakan Copy JWT atau sederhanakan data credential.'
        );
      }

      setPresentationJwt(vpJwt);
      setPresentationMeta(vp);

      showToast('Credential berhasil ditandatangani sebagai VP JWT.', 'success');
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
  const mainCredentialJwt = getCredentialJwt(mainCredential);
  const issuerText = getIssuerText(mainCredential.issuer);

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
          <Text style={styles.documentSubtitle}>Satu Credential Utuh</Text>

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
            Issuer: {issuerText}
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

          {!mainCredentialJwt ? (
            <View style={styles.legacyWarningBox}>
              <Ionicons name="warning-outline" size={24} color="#F97316" />
              <Text style={styles.legacyWarningText}>
                Credential lama belum sesuai format baru. Hapus credential ini dan buat ulang sebagai satu credential utuh.
              </Text>
            </View>
          ) : null}

          <AnimatedButton
            style={[
              styles.presentButton,
              !isCredentialPresentable(mainCredential) && styles.disabledButton,
            ]}
            disabled={!isCredentialPresentable(mainCredential)}
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
                    Credential Count: {presentationMeta?.credentialCount || 1}
                  </Text>
                  <Text style={styles.qrStatusText}>JWT Length: {qrJwt.length}</Text>
                </View>

                <Text style={styles.verifyOnlyText}>SCAN QR INI DI TAB VERIFY</Text>

                {canRenderQr ? (
                  <View style={styles.qrBox}>
                    <QRCode value={qrJwt} size={220} />
                  </View>
                ) : (
                  <View style={styles.qrTooLargeBox}>
                    <Ionicons name="warning-outline" size={34} color="#F97316" />
                    <Text style={styles.qrTooLargeTitle}>
                      VP JWT terlalu panjang untuk QR Code
                    </Text>
                    <Text style={styles.qrTooLargeText}>
                      Credential berhasil ditandatangani, tetapi datanya terlalu besar untuk dimasukkan ke QR. Gunakan Copy JWT.
                    </Text>
                  </View>
                )}

                <Text style={styles.qrNote}>
                  QR ini berisi VP JWT murni dengan format header.payload.signature.
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

  if (expiration.isExpired || expiration.isNotYetValid) return false;
  if (!getCredentialJwt(credential)) return false;

  return !INVALID_PRESENTATION_STATUSES.includes(
    String(credential.verificationStatus ?? '')
  );
}

function getCredentialBlockedReason(credential: ModularCredential): string {
  const expiration = checkCredentialExpiration(credential);

  if (!getCredentialJwt(credential)) {
    return 'Credential lama belum sesuai format baru. Hapus credential ini dan buat ulang sebagai satu credential utuh.';
  }

  if (expiration.isExpired) return 'Credential ini sudah expired.';
  if (expiration.isNotYetValid) return 'Credential ini belum berlaku.';

  if (
    INVALID_PRESENTATION_STATUSES.includes(
      String(credential.verificationStatus ?? '')
    )
  ) {
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

function getDocumentIcon(documentType: string): any {
  if (documentType === 'KTP') return 'id-card-outline';
  if (documentType === 'KTM') return 'school-outline';
  if (documentType === 'SIM') return 'car-outline';
  if (documentType === 'IJAZAH') return 'school-outline';

  return 'document-text-outline';
}

function getMainCredential(document: CredentialDocument) {
  const credentials = document.credentials ?? [];

  const fullDocumentCredential = credentials.find((credential) => {
    const subject = credential.credentialSubject as any;

    return Boolean(
      getCredentialJwt(credential) &&
        subject &&
        (
          subject.nama ||
          subject.fullName ||
          subject.nik ||
          subject.alamat ||
          subject.address
        )
    );
  });

  if (fullDocumentCredential) {
    return fullDocumentCredential;
  }

  return (
    credentials.find((credential) => Boolean(getCredentialJwt(credential))) ||
    credentials[0] ||
    null
  );
}

function getMainCredentialStatus(document: CredentialDocument) {
  const mainCredential = getMainCredential(document);
  const validUntil =
    mainCredential?.validUntil ||
    mainCredential?.expirationDate ||
    (typeof mainCredential?.credentialSubject?.berlakuHingga === 'string'
      ? mainCredential.credentialSubject.berlakuHingga
      : undefined) ||
    (typeof mainCredential?.credentialSubject?.validUntilText === 'string'
      ? mainCredential.credentialSubject.validUntilText
      : undefined);

  if (!validUntil) {
    return {
      status: 'VALID',
      label: 'VALID',
    };
  }

  const normalized = String(validUntil).trim().toLowerCase();

  if (
    normalized === 'seumur hidup' ||
    normalized === 'berlaku seumur hidup' ||
    normalized === 'lifetime'
  ) {
    return {
      status: 'VALID',
      label: 'VALID',
    };
  }

  const validUntilDate = new Date(validUntil);

  if (Number.isNaN(validUntilDate.getTime())) {
    return {
      status: 'VALID',
      label: 'VALID',
    };
  }

  const isExpired = validUntilDate < new Date();

  return {
    status: isExpired ? 'EXPIRED' : 'VALID',
    label: isExpired ? 'EXPIRED' : 'VALID',
  };
}

function buildCredentialDetailItems(
  document: CredentialDocument,
  credential: ModularCredential
): DetailItem[] {
  const subject = credential.credentialSubject || {};
  const items: DetailItem[] = [];

  const ignoredKeys = new Set([
    'id',
    'documentId',
    'documentType',
    'documentName',
    'attributeType',
    'attributeName',
    'attributeValue',
  ]);

  const preferredOrder = [
    'nama',
    'fullName',
    'legalName',
    'nik',
    'tempatLahir',
    'birthPlace',
    'tanggalLahir',
    'birthDate',
    'jenisKelamin',
    'gender',
    'alamat',
    'address',
    'agama',
    'religion',
    'statusPerkawinan',
    'maritalStatus',
    'pekerjaan',
    'occupation',
    'kewarganegaraan',
    'citizenship',
    'berlakuHingga',
    'validUntilText',
    'validUntil',
  ];

  if (isRecord(subject)) {
    const addedKeys = new Set<string>();

    for (const key of preferredOrder) {
      const value = subject[key];

      if (value === undefined || value === null || value === '') {
        continue;
      }

      if (addedKeys.has(key)) {
        continue;
      }

      items.push({
        key,
        label: normalizeLabel(key),
        value: stringifyValue(value),
      });

      addedKeys.add(key);
    }

    Object.entries(subject).forEach(([key, value]) => {
      if (ignoredKeys.has(key)) return;
      if (preferredOrder.includes(key)) return;
      if (value === undefined || value === null || value === '') return;

      items.push({
        key,
        label: normalizeLabel(key),
        value: stringifyValue(value),
      });
    });

    if (items.length > 0) {
      return items;
    }

    const legacyAttributeName = subject.attributeName;
    const legacyAttributeValue = subject.attributeValue;

    if (legacyAttributeName || legacyAttributeValue) {
      return [
        {
          key: 'legacyWarning',
          label: 'Format Credential',
          value:
            'Credential ini masih format lama per atribut. Hapus dan buat ulang KTP agar detail tampil lengkap sebagai satu credential.',
        },
        {
          key: 'legacyAttributeName',
          label: 'Atribut Lama',
          value: stringifyValue(legacyAttributeName),
        },
        {
          key: 'legacyAttributeValue',
          label: 'Nilai Atribut Lama',
          value: stringifyValue(legacyAttributeValue),
        },
      ];
    }
  }

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
  presentButton: {
    backgroundColor: '#2563EB',
    borderRadius: 18,
    paddingVertical: 16,
    marginTop: 12,
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
  emptyText: {
    color: '#6B7280',
    fontWeight: '700',
    lineHeight: 20,
  },
  legacyWarningBox: {
    backgroundColor: '#FFF7ED',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  legacyWarningText: {
    color: '#9A3412',
    fontWeight: '800',
    flex: 1,
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
  verifyOnlyText: {
    color: '#2563EB',
    fontWeight: '900',
    fontSize: 12,
    marginBottom: 12,
    letterSpacing: 1,
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  qrTooLargeBox: {
    backgroundColor: '#FFF7ED',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  qrTooLargeTitle: {
    color: '#9A3412',
    fontWeight: '900',
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  qrTooLargeText: {
    color: '#9A3412',
    fontWeight: '700',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 19,
    textAlign: 'center',
  },
  qrNote: {
    color: '#64748B',
    fontSize: 12,
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
    fontSize: 11,
    lineHeight: 16,
  },
});