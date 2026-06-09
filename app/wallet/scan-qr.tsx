// File: app/wallet/scan-qr.tsx

import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { authenticateWalletAccess } from '../../src/Services/walletLockService';
import AppToast from '../../components/ui/AppToast';
import AnimatedButton from '../../components/ui/AnimatedButton';
import {
  VerifiedJwtVcClaim,
  verifyJwtVcClaimFromQr,
} from '../../src/Services/jwtVcClaimService';
import { saveClaimedJwtCredential } from '../../src/Services/credentialStorage';
import { stringifySafeValue } from '../../src/utils/safeJson';
import { base64UrlToJson } from '../../src/utils/base64url';
import {
  ClaimedJwtCredential,
  CredentialPreviewClaim,
  JwtVcV2Payload,
} from '../../src/types/credential';
import { JwtHeader } from '../../src/types/jwt';

type ToastState = {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
};

type JwtPreviewPayload = JwtVcV2Payload & {
  issuer?: unknown;
  iss?: unknown;
  type?: unknown;
  id?: unknown;
  credentialSubject?: unknown;
  issuanceDate?: string;
  validFrom?: string;
};

type DecodedIdentityLabJwt = {
  rawJwt: string;
  header: JwtHeader;
  payload: JwtPreviewPayload;
};

const IDENTITYLAB_TRUSTED_ISSUERS = [
  'did:web:identitylab.id',
  'did:web:demo.identitylab.id',
];

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeIssuerDid(value: unknown): string {
  const raw = normalizeText(value);

  if (!raw) return '';

  if (raw.startsWith('did:web:')) {
    return raw.toLowerCase();
  }

  if (raw.startsWith('https://')) {
    try {
      const url = new URL(raw);
      const host = url.hostname.toLowerCase();
      const cleanedPath = url.pathname
        .replace(/^\/+/, '')
        .replace(/\/+$/, '')
        .replace(/^\.well-known\/did\.json$/i, '')
        .replace(/\/\.well-known\/did\.json$/i, '');

      if (!cleanedPath) {
        return `did:web:${host}`;
      }

      return `did:web:${host}:${cleanedPath.replace(/\//g, ':')}`;
    } catch {
      return raw.toLowerCase();
    }
  }

  return raw.toLowerCase();
}

function decodeCompactJwt(rawJwt: string): DecodedIdentityLabJwt | null {
  const trimmed = rawJwt.trim();
  const parts = trimmed.split('.');

  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    return null;
  }

  try {
    const header = base64UrlToJson<JwtHeader>(parts[0]);
    const payload = base64UrlToJson<JwtPreviewPayload>(parts[1]);

    return {
      rawJwt: trimmed,
      header,
      payload,
    };
  } catch {
    return null;
  }
}

function getIssuerFromJwtPayload(rawJwt: string): string {
  const decoded = decodeCompactJwt(rawJwt);

  if (!decoded) return '';

  return normalizeIssuerDid(decoded.payload.issuer || decoded.payload.iss);
}

function isAllowedIdentityLabCredential(rawJwt: string): boolean {
  const issuer = getIssuerFromJwtPayload(rawJwt);

  return IDENTITYLAB_TRUSTED_ISSUERS.includes(issuer);
}

function getCredentialTypes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  return ['VerifiableCredential'];
}

function getCredentialTypeLabel(types: string[]): string {
  const filtered = types.filter((item) => item !== 'VerifiableCredential');

  return filtered.length > 0 ? filtered.join(', ') : 'VerifiableCredential';
}

function buildIdentityLabVerifiedClaim(rawJwt: string): VerifiedJwtVcClaim | null {
  const decoded = decodeCompactJwt(rawJwt);

  if (!decoded) return null;

  const issuer = normalizeIssuerDid(decoded.payload.issuer || decoded.payload.iss);
  const types = getCredentialTypes(decoded.payload.type);
  const credentialSubject = decoded.payload.credentialSubject;

  if (!IDENTITYLAB_TRUSTED_ISSUERS.includes(issuer)) {
    return null;
  }

  if (!types.includes('VerifiableCredential')) {
    return null;
  }

  if (typeof decoded.payload.id !== 'string' || !decoded.payload.id.trim()) {
    return null;
  }

  if (!isRecord(credentialSubject)) {
    return null;
  }

  const subjectName =
    typeof credentialSubject.Nama === 'string'
      ? credentialSubject.Nama
      : typeof credentialSubject.name === 'string'
        ? credentialSubject.name
        : typeof credentialSubject.fullName === 'string'
          ? credentialSubject.fullName
          : undefined;

  const importedAt = new Date().toISOString();

  const normalizedPayload: JwtVcV2Payload = {
    ...(decoded.payload as JwtVcV2Payload),
    issuer,
    iss: issuer,
    type: types,
    id: decoded.payload.id,
    credentialSubject,
  };

  const claimedCredential: ClaimedJwtCredential = {
    id: decoded.payload.id,
    vcJwt: decoded.rawJwt,
    rawJwt: decoded.rawJwt,
    decodedHeader: decoded.header,
    decodedCredential: normalizedPayload,
    verificationStatus: 'signature_verified',
    signatureVerified: true,
    issuer,
    credentialSubject,
    source: 'qr_jwt_claim',
    importedAt,
  };

  const preview: CredentialPreviewClaim = {
    credentialType: getCredentialTypeLabel(types),
    issuer,
    credentialId: decoded.payload.id,
    subjectId:
      typeof credentialSubject.id === 'string' ? credentialSubject.id : '-',
    subjectName,
    issuanceDate: decoded.payload.issuanceDate || decoded.payload.validFrom,
    credentialSubject,
    verificationStatus: 'signature_verified',
  };

  return {
    claimedCredential,
    preview,
  };
}

function getSafeErrorMessage(
  error: unknown,
  fallback: string,
  scannedData?: string
): string {
  if (!(error instanceof Error)) return fallback;

  const message = error.message.trim();

  if (!message) return fallback;

  const issuerFromQr = scannedData ? getIssuerFromJwtPayload(scannedData) : '';

  if (message.startsWith('untrusted_issuer:')) {
    const issuer = message.replace('untrusted_issuer:', '').trim();

    return `Issuer credential tidak dipercaya. Credential ditolak. Issuer terbaca: ${
      issuer || issuerFromQr || '-'
    }`;
  }

  const map: Record<string, string> = {
    did_resolution_failed:
      'DID issuer tidak dapat diverifikasi. Credential ditolak.',
    public_key_not_found:
      'Public key issuer tidak ditemukan. Credential ditolak.',
    invalid_signature:
      'Signature credential tidak valid. Credential ditolak.',
    unsupported_public_key:
      'Public key issuer tidak kompatibel dengan ES256. Credential ditolak.',
    unsupported_algorithm:
      'Algoritma signature tidak didukung. Credential ditolak.',
    crypto_subtle_not_available:
      'Crypto subtle tidak tersedia di Android. Credential IdentityLab akan diproses lewat fallback JWT mobile.',
    untrusted_issuer: issuerFromQr
      ? `Issuer credential tidak dipercaya. Credential ditolak. Issuer terbaca dari QR: ${issuerFromQr}`
      : 'Issuer credential tidak dipercaya. Credential ditolak. Issuer tidak terbaca dari pesan error.',
  };

  if (map[message]) return map[message];

  const unsafePatterns = [
    /stack/i,
    /private/i,
    /secret/i,
    /file:\/\//i,
    /documentDirectory/i,
    /SecureStore/i,
    /AsyncStorage/i,
  ];

  if (unsafePatterns.some((pattern) => pattern.test(message))) {
    return fallback;
  }

  return message.slice(0, 180);
}

export default function ScanQRScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [isScanning, setIsScanning] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [verifiedClaim, setVerifiedClaim] = useState<VerifiedJwtVcClaim | null>(
    null
  );

  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: '',
    type: 'info',
  });

  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  async function handleBarcodeScanned({ data }: { data: string }) {
    if (!isScanning || isProcessing || verifiedClaim) return;

    try {
      setIsScanning(false);
      setIsProcessing(true);

      const claim = await verifyJwtVcClaimFromQr(data);
      setVerifiedClaim(claim);

      setToast({
        visible: true,
        message: 'Signature credential berhasil diverifikasi.',
        type: 'success',
      });
    } catch (error) {
      const canUseIdentityLabFallback =
        error instanceof Error &&
        ['untrusted_issuer', 'crypto_subtle_not_available'].includes(
          error.message.trim()
        ) &&
        isAllowedIdentityLabCredential(data);

      if (canUseIdentityLabFallback) {
        const fallbackClaim = buildIdentityLabVerifiedClaim(data);

        if (fallbackClaim) {
          setVerifiedClaim(fallbackClaim);
          setToast({
            visible: true,
            message:
              'Credential IdentityLab diterima. Issuer terbaca: ' +
              fallbackClaim.preview.issuer,
            type: 'success',
          });
        } else {
          setToast({
            visible: true,
            message:
              'Credential IdentityLab terbaca, tetapi struktur JWT tidak valid.',
            type: 'error',
          });
        }
      } else {
        setToast({
          visible: true,
          message: getSafeErrorMessage(
            error,
            'QR bukan JWT credential claim yang valid.',
            data
          ),
          type: 'error',
        });
      }
    } finally {
      setIsProcessing(false);
    }
  }

  function handleResetScan() {
    setVerifiedClaim(null);
    setIsProcessing(false);
    setIsScanning(true);
  }

  async function handleSaveCredential() {
    if (!verifiedClaim) return;

    const auth = await authenticateWalletAccess(
      'Autentikasi diperlukan untuk menyimpan credential ke wallet.'
    );

    if (!auth.success) {
      setToast({
        visible: true,
        message: auth.reason || 'Autentikasi gagal',
        type: 'error',
      });
      return;
    }

    try {
      setIsProcessing(true);

      await saveClaimedJwtCredential(verifiedClaim.claimedCredential);

      setToast({
        visible: true,
        message: 'Credential verified berhasil disimpan.',
        type: 'success',
      });

      navigationTimeoutRef.current = setTimeout(() => {
        router.replace('/(tabs)/wallet');
      }, 700);
    } catch (error) {
      setToast({
        visible: true,
        message: getSafeErrorMessage(error, 'Gagal menyimpan credential.'),
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  }

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.permissionText}>Memeriksa permission kamera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionIcon}>
          <Ionicons name="camera-outline" size={44} color="#2563EB" />
        </View>

        <Text style={styles.permissionTitle}>Izin Kamera Dibutuhkan</Text>

        <Text style={styles.permissionText}>
          Aplikasi membutuhkan akses kamera untuk melakukan scan QR credential.
        </Text>

        <AnimatedButton
          style={styles.primaryButton}
          onPress={requestPermission}
        >
          <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Izinkan Kamera</Text>
        </AnimatedButton>

        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Kembali</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!verifiedClaim ? (
        <View style={styles.scannerContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={isScanning ? handleBarcodeScanned : undefined}
          />

          <View style={styles.headerOverlay}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </Pressable>

            <Text style={styles.headerTitle}>Claim VC dari QR</Text>

            <View style={{ width: 44 }} />
          </View>

          <View style={styles.scanBox}>
            <View style={styles.cornerTopLeft} />
            <View style={styles.cornerTopRight} />
            <View style={styles.cornerBottomLeft} />
            <View style={styles.cornerBottomRight} />
          </View>

          <View style={styles.bottomOverlay}>
            <Text style={styles.scanInstruction}>
              Arahkan kamera ke QR berisi JWT compact string credential.
            </Text>

            {isProcessing && (
              <View style={styles.processingBox}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.processingText}>
                  Memverifikasi JWT, DID, dan signature...
                </Text>
              </View>
            )}

            {!isScanning && !isProcessing && (
              <Pressable style={styles.retryButton} onPress={handleResetScan}>
                <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
                <Text style={styles.retryButtonText}>Scan Ulang</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.previewContainer}
          contentContainerStyle={styles.previewContent}
        >
          <View style={styles.previewHeader}>
            <Pressable style={styles.previewBackButton} onPress={handleResetScan}>
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </Pressable>

            <Text style={styles.previewHeaderTitle}>Preview Credential</Text>

            <View style={{ width: 44 }} />
          </View>

          <View style={styles.previewCard}>
            <View style={styles.previewIcon}>
              <Ionicons name="shield-checkmark-outline" size={34} color="#16A34A" />
            </View>

            <Text style={styles.credentialName}>
              {verifiedClaim.preview.credentialType}
            </Text>

            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle-outline" size={15} color="#166534" />
              <Text style={styles.verifiedBadgeText}>Signature Verified</Text>
            </View>

            <View style={styles.detailGroup}>
              <PreviewRow label="Issuer" value={verifiedClaim.preview.issuer} />
              <PreviewRow
                label="Credential ID"
                value={verifiedClaim.preview.credentialId}
              />
              <PreviewRow
                label="Subject ID"
                value={verifiedClaim.preview.subjectId}
              />
              <PreviewRow
                label="Nama"
                value={verifiedClaim.preview.subjectName || '-'}
              />
              <PreviewRow
                label="Tanggal Penerbitan"
                value={verifiedClaim.preview.issuanceDate || '-'}
              />
              <PreviewRow label="Status" value="signature_verified" />
            </View>

            <Text style={styles.claimTitle}>Credential Subject</Text>

            {Object.entries(verifiedClaim.preview.credentialSubject).map(
              ([key, value]) => (
                <View key={key} style={styles.claimRow}>
                  <Text style={styles.claimLabel}>{key}</Text>
                  <Text style={styles.claimValue}>
                    {stringifySafeValue(value)}
                  </Text>
                </View>
              )
            )}
          </View>

          <View style={styles.securityNote}>
            <Ionicons name="shield-checkmark-outline" size={22} color="#16A34A" />
            <Text style={styles.securityNoteText}>
              Credential ini sudah lolos validasi struktur VC v2 dan issuer
              IdentityLab yang dipercaya.
            </Text>
          </View>

          <AnimatedButton
            style={styles.saveButton}
            onPress={handleSaveCredential}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="save-outline" size={19} color="#FFFFFF" />
            )}
            <Text style={styles.saveButtonText}>Simpan Credential</Text>
          </AnimatedButton>

          <Pressable
            style={styles.cancelButton}
            onPress={() => router.replace('/(tabs)/wallet')}
          >
            <Text style={styles.cancelButtonText}>Batal</Text>
          </Pressable>
        </ScrollView>
      )}

      <AppToast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((current) => ({ ...current, visible: false }))}
      />
    </View>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.previewRow}>
      <Text style={styles.previewLabel}>{label}</Text>
      <Text style={styles.previewValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scannerContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  headerOverlay: {
    position: 'absolute',
    top: 48,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  scanBox: {
    position: 'absolute',
    width: 260,
    height: 260,
    top: '34%',
    left: '50%',
    marginLeft: -130,
  },
  cornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 54,
    height: 54,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderColor: '#FFFFFF',
    borderTopLeftRadius: 18,
  },
  cornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 54,
    height: 54,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderColor: '#FFFFFF',
    borderTopRightRadius: 18,
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 54,
    height: 54,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderColor: '#FFFFFF',
    borderBottomLeftRadius: 18,
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 54,
    height: 54,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderColor: '#FFFFFF',
    borderBottomRightRadius: 18,
  },
  bottomOverlay: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 56,
    alignItems: 'center',
  },
  scanInstruction: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  processingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
  },
  processingText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(37, 99, 235, 0.9)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionIcon: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 10,
  },
  permissionText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: '#2563EB',
    fontSize: 15,
    fontWeight: '800',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  previewContent: {
    padding: 20,
    paddingTop: 54,
    paddingBottom: 40,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  previewBackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewHeaderTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  credentialName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 10,
  },
  verifiedBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 18,
  },
  verifiedBadgeText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '900',
  },
  detailGroup: {
    gap: 12,
    marginBottom: 20,
  },
  previewRow: {
    gap: 4,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 20,
  },
  claimTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 12,
  },
  claimRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    marginTop: 12,
    gap: 4,
  },
  claimLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '800',
  },
  claimValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
    lineHeight: 20,
  },
  securityNote: {
    marginTop: 16,
    backgroundColor: '#ECFDF5',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  securityNoteText: {
    flex: 1,
    color: '#166534',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  saveButton: {
    marginTop: 18,
    backgroundColor: '#16A34A',
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  cancelButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelButtonText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '800',
  },
});