import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import {
  verifyPresentationJWT,
  UniversalVerificationResult,
  VerifiedCredentialView,
  extractJwtFromQrData,
  decodeJWT,
} from '../../src/Services/verificationService';

import AppToast from '../../components/ui/AppToast';
import AnimatedButton from '../../components/ui/AnimatedButton';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import { safeLogger } from '../../src/utils/safeLogger';

function shorten(value?: string) {
  if (!value) return '-';
  if (value.length <= 24) return value;

  return `${value.slice(0, 14)}...${value.slice(-8)}`;
}

function isJwtLikeString(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const parts = value.trim().split('.');

  return (
    parts.length === 3 &&
    parts[0].length > 0 &&
    parts[1].length > 0 &&
    parts[2].length > 0
  );
}

function getResultTitle(result: UniversalVerificationResult | null) {
  if (!result) return 'SCAN RESULT';

  if (result.kind === 'vp-jwt') return 'VP JWT TERBACA';
  if (result.kind === 'vc-jwt') return 'VC JWT TERBACA';

  return 'QR TIDAK VALID';
}

function getResultSubtitle(result: UniversalVerificationResult | null) {
  if (!result) {
    return 'Hasil scan QR.';
  }

  if (result.kind === 'vp-jwt') {
    return result.signatureVerified
      ? 'QR berisi VP JWT signed dan signature terverifikasi.'
      : 'QR berisi VP JWT. Signature cryptographic verification belum dilakukan penuh.';
  }

  if (result.kind === 'vc-jwt') {
    return result.signatureVerified
      ? 'QR berisi VC JWT signed dan signature terverifikasi.'
      : 'QR berisi VC JWT. Signature cryptographic verification belum dilakukan penuh.';
  }

  return result.warning || 'QR tidak dapat dibaca.';
}

function inspectQrSafely(data: string) {
  const trimmed = data?.trim?.() || '';
  const directJwtParts = isJwtLikeString(trimmed) ? trimmed.split('.').length : 0;

  try {
    const jwt = extractJwtFromQrData(trimmed);
    const decoded = decodeJWT(jwt);

    return {
      length: trimmed.length,
      jwtParts: jwt.split('.').length,
      payloadKind: decoded.payload?.vp
        ? 'vp-jwt'
        : decoded.payload?.vc
          ? 'vc-jwt'
          : 'unknown',
      directJwtParts,
    };
  } catch {
    return {
      length: trimmed.length,
      jwtParts: directJwtParts,
      payloadKind: 'unknown',
      directJwtParts,
    };
  }
}

export default function ScanPresentationScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  const [rawQr, setRawQr] = useState('');
  const [verified, setVerified] = useState<boolean | null>(null);
  const [holderDid, setHolderDid] = useState('');
  const [didDocument, setDidDocument] = useState<any | null>(null);
  const [publicKeyInfo, setPublicKeyInfo] = useState<any | null>(null);
  const [presentedCredentials, setPresentedCredentials] = useState<
    VerifiedCredentialView[]
  >([]);
  const [decodedPayload, setDecodedPayload] = useState<any | null>(null);
  const [verificationResult, setVerificationResult] =
    useState<UniversalVerificationResult | null>(null);
  const [debugInfo, setDebugInfo] = useState({
    length: 0,
    jwtParts: 0,
    payloadKind: 'unknown',
    directJwtParts: 0,
  });

  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'info',
  });

  async function handleBarcodeScanned({ data }: { data: string }) {
    if (scanned) return;

    setScanned(true);

    try {
      setLoading(true);

      const inspected = inspectQrSafely(data);
      setDebugInfo(inspected);

      safeLogger.warn('QR scanned debug', {
        length: inspected.length,
        jwtParts: inspected.jwtParts,
        payloadKind: inspected.payloadKind,
      });

      const result = await verifyPresentationJWT(data);

      setRawQr(result.rawJwt || data);
      setVerified(result.valid);
      setHolderDid(result.holderDid || '');
      setDidDocument(result.didDocument || null);
      setPublicKeyInfo(
        result.verificationMethod?.[0] ||
          result.authentication?.[0] ||
          result.assertionMethod?.[0] ||
          null
      );
      setPresentedCredentials(result.credentials || []);
      setDecodedPayload(result.decoded?.payload || null);
      setVerificationResult(result);

      setToast({
        visible: true,
        message: result.valid
          ? result.kind === 'vp-jwt'
            ? 'VP JWT berhasil dibaca.'
            : 'VC JWT berhasil dibaca.'
          : result.warning || 'QR tidak valid.',
        type: result.valid ? 'success' : 'error',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'QR gagal dibaca';

      safeLogger.warn('QR verification failed', { message });

      setRawQr(data);
      setVerified(false);
      setHolderDid('');
      setDidDocument(null);
      setPublicKeyInfo(null);
      setPresentedCredentials([]);
      setDecodedPayload(null);
      setVerificationResult({
        valid: false,
        structurallyValid: false,
        signatureVerified: false,
        kind: 'unknown',
        holderDid: '',
        credentials: [],
        warning: message,
      });

      setToast({
        visible: true,
        message,
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  function handleScanAgain() {
    setScanned(false);
    setLoading(false);
    setRawQr('');
    setVerified(null);
    setHolderDid('');
    setDidDocument(null);
    setPublicKeyInfo(null);
    setPresentedCredentials([]);
    setDecodedPayload(null);
    setVerificationResult(null);
    setDebugInfo({
      length: 0,
      jwtParts: 0,
      payloadKind: 'unknown',
      directJwtParts: 0,
    });
  }

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="camera-outline" size={48} color="#2563EB" />
        <Text style={styles.centerTitle}>Memuat Kamera</Text>
        <Text style={styles.centerText}>Menyiapkan permission kamera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="camera-outline" size={56} color="#2563EB" />
        <Text style={styles.centerTitle}>Izin Kamera Dibutuhkan</Text>
        <Text style={styles.centerText}>
          Aplikasi membutuhkan akses kamera untuk scan QR VP JWT atau VC JWT.
        </Text>

        <AnimatedButton
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>Izinkan Kamera</Text>
        </AnimatedButton>
      </View>
    );
  }

  if (verified !== null) {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back-outline" size={20} color="#111827" />
            <Text style={styles.backText}>Kembali</Text>
          </Pressable>

          <LinearGradient
            colors={
              verified
                ? ['#16A34A', '#15803D', '#2563EB']
                : ['#DC2626', '#991B1B', '#F97316']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.resultHero}
          >
            <View>
              <Text style={styles.heroLabel}>Verification Result</Text>
              <Text style={styles.heroTitle}>
                {getResultTitle(verificationResult)}
              </Text>
              <Text style={styles.heroSubtitle}>
                {getResultSubtitle(verificationResult)}
              </Text>
            </View>

            <View style={styles.heroIcon}>
              <Ionicons
                name={
                  verified
                    ? 'checkmark-circle-outline'
                    : 'close-circle-outline'
                }
                size={36}
                color={verified ? '#16A34A' : '#DC2626'}
              />
            </View>
          </LinearGradient>

          <View style={styles.statusCard}>
            <Ionicons
              name={verified ? 'shield-checkmark-outline' : 'warning-outline'}
              size={22}
              color={verified ? '#16A34A' : '#DC2626'}
            />

            <Text
              style={[
                styles.statusText,
                { color: verified ? '#166534' : '#991B1B' },
              ]}
            >
              {verified
                ? getResultSubtitle(verificationResult)
                : verificationResult?.warning ||
                  'QR gagal diverifikasi atau tidak dapat dibaca.'}
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Debug QR Aman</Text>
            <Text style={styles.debugText}>QR Length: {debugInfo.length}</Text>
            <Text style={styles.debugText}>JWT Parts: {debugInfo.jwtParts}</Text>
            <Text style={styles.debugText}>Payload Kind: {debugInfo.payloadKind}</Text>
            <Text style={styles.debugText}>
              Signature Verified: {verificationResult?.signatureVerified ? 'Ya' : 'Belum'}
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBlue}>
                <Ionicons
                  name="person-circle-outline"
                  size={22}
                  color="#2563EB"
                />
              </View>
              <Text style={styles.sectionTitle}>Holder / Subject DID</Text>
            </View>

            <Text style={styles.value}>{holderDid || '-'}</Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBlue}>
                <Ionicons name="id-card-outline" size={22} color="#2563EB" />
              </View>
              <Text style={styles.sectionTitle}>Data Credential</Text>
            </View>

            {presentedCredentials.length > 0 ? (
              presentedCredentials.map((credential, index) => (
                <View key={index} style={styles.presentedItem}>
                  {credential.error ? (
                    <>
                      <Text style={styles.presentedLabel}>Credential Error</Text>
                      <Text style={styles.presentedValue}>{credential.error}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.presentedLabel}>
                        {credential.attributeName || 'Credential'}
                      </Text>
                      <Text style={styles.presentedValue}>
                        {credential.attributeValue || '-'}
                      </Text>
                      <Text style={styles.presentedMeta}>
                        Type: {credential.attributeType || '-'}
                      </Text>
                      <Text style={styles.presentedMeta}>
                        Issuer: {shorten(credential.issuer)}
                      </Text>
                      <Text style={styles.presentedMeta}>
                        Subject: {shorten(credential.subject)}
                      </Text>
                      <Text style={styles.presentedMeta}>
                        Issued At: {String(credential.issuanceDate || '-')}
                      </Text>
                    </>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>
                Tidak ada credential yang dapat dibaca dari QR.
              </Text>
            )}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconOrange}>
                <Ionicons
                  name="document-text-outline"
                  size={22}
                  color="#F97316"
                />
              </View>
              <Text style={styles.sectionTitle}>DID Document</Text>
            </View>

            {didDocument ? (
              <Text style={styles.jsonText}>
                {JSON.stringify(didDocument, null, 2)}
              </Text>
            ) : (
              <Text style={styles.emptyText}>
                DID Document tidak tersedia atau belum berhasil di-resolve.
              </Text>
            )}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Decoded Payload</Text>
            {decodedPayload ? (
              <Text style={styles.jsonText}>
                {JSON.stringify(decodedPayload, null, 2)}
              </Text>
            ) : (
              <Text style={styles.emptyText}>Payload tidak tersedia.</Text>
            )}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Raw JWT / QR</Text>
            <Text style={styles.jwtText}>{rawQr || '-'}</Text>
          </View>

          <AnimatedButton style={styles.scanAgainButton} onPress={handleScanAgain}>
            <Ionicons name="scan-outline" size={22} color="#FFFFFF" />
            <Text style={styles.scanAgainText}>Scan Ulang</Text>
          </AnimatedButton>
        </ScrollView>

        <LoadingOverlay visible={loading} message="Memverifikasi QR..." />

        <AppToast
          visible={toast.visible}
          message={toast.message}
          type={toast.type}
          onHide={() => setToast({ ...toast, visible: false })}
        />
      </View>
    );
  }

  return (
    <View style={styles.scannerContainer}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      <View style={styles.scannerOverlay}>
        <Pressable style={styles.backButtonScanner} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={20} color="#FFFFFF" />
          <Text style={styles.backTextScanner}>Kembali</Text>
        </Pressable>

        <View style={styles.scanFrame}>
          <View style={styles.cornerTopLeft} />
          <View style={styles.cornerTopRight} />
          <View style={styles.cornerBottomLeft} />
          <View style={styles.cornerBottomRight} />
        </View>

        <View style={styles.scanInstruction}>
          <Text style={styles.scanTitle}>Scan QR Credential</Text>
          <Text style={styles.scanText}>
            Arahkan kamera ke QR Signed Presentation yang berisi VP JWT, atau QR VC JWT langsung.
          </Text>
        </View>
      </View>

      <LoadingOverlay visible={loading} message="Memverifikasi QR..." />

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
  centerContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  centerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    marginTop: 16,
  },
  centerText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  permissionButton: {
    marginTop: 24,
    backgroundColor: '#2563EB',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 16,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
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
  resultHero: {
    borderRadius: 28,
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroLabel: {
    color: '#E0F2FE',
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
    maxWidth: 250,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusText: {
    flex: 1,
    fontWeight: '800',
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
  sectionIconOrange: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 8,
  },
  value: {
    color: '#111827',
    fontWeight: '700',
    lineHeight: 20,
  },
  presentedItem: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  presentedLabel: {
    color: '#111827',
    fontWeight: '900',
    marginBottom: 6,
  },
  presentedValue: {
    color: '#374151',
    fontWeight: '800',
    marginBottom: 8,
  },
  presentedMeta: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  emptyText: {
    color: '#6B7280',
    fontWeight: '700',
    lineHeight: 20,
  },
  jsonText: {
    color: '#374151',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  jwtText: {
    color: '#374151',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 17,
  },
  debugText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  scanAgainButton: {
    backgroundColor: '#2563EB',
    borderRadius: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scanAgainText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scannerOverlay: {
    flex: 1,
    padding: 22,
    justifyContent: 'space-between',
  },
  backButtonScanner: {
    marginTop: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  backTextScanner: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  scanFrame: {
    width: 260,
    height: 260,
    alignSelf: 'center',
    position: 'relative',
  },
  cornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 64,
    height: 64,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderColor: '#FFFFFF',
    borderTopLeftRadius: 22,
  },
  cornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 64,
    height: 64,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderColor: '#FFFFFF',
    borderTopRightRadius: 22,
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 64,
    height: 64,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderColor: '#FFFFFF',
    borderBottomLeftRadius: 22,
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 64,
    height: 64,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderColor: '#FFFFFF',
    borderBottomRightRadius: 22,
  },
  scanInstruction: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 22,
    padding: 18,
    marginBottom: 24,
  },
  scanTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  scanText: {
    color: '#E5E7EB',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    fontWeight: '700',
  },
});