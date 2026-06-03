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
    return 'QR berisi VP JWT signed dan credential JWT di dalamnya.';
  }

  if (result.kind === 'vc-jwt') {
    return 'QR berisi VC JWT signed.';
  }

  return result.warning || 'QR tidak dapat dibaca.';
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
        message: result.valid ? 'QR JWT berhasil dibaca' : result.warning || 'QR tidak valid',
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
                DID Document tidak ditemukan atau QR tidak memakai did:key.
              </Text>
            )}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBlue}>
                <Ionicons name="key-outline" size={22} color="#2563EB" />
              </View>
              <Text style={styles.sectionTitle}>
                Public Key / Verification Method
              </Text>
            </View>

            {publicKeyInfo ? (
              <Text style={styles.jsonText}>
                {JSON.stringify(publicKeyInfo, null, 2)}
              </Text>
            ) : (
              <Text style={styles.emptyText}>
                Public key atau verification method tidak ditemukan.
              </Text>
            )}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconOrange}>
                <Ionicons name="code-slash-outline" size={22} color="#F97316" />
              </View>
              <Text style={styles.sectionTitle}>Decoded JWT Payload</Text>
            </View>

            {decodedPayload ? (
              <Text style={styles.jsonText}>
                {JSON.stringify(decodedPayload, null, 2)}
              </Text>
            ) : (
              <Text style={styles.emptyText}>Payload tidak tersedia.</Text>
            )}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBlue}>
                <Ionicons name="qr-code-outline" size={22} color="#2563EB" />
              </View>
              <Text style={styles.sectionTitle}>Raw JWT</Text>
            </View>

            <Text style={styles.jwtText}>{rawQr || '-'}</Text>
          </View>

          <AnimatedButton style={styles.scanAgainButton} onPress={handleScanAgain}>
            <Ionicons name="scan-outline" size={20} color="#FFFFFF" />
            <Text style={styles.scanAgainButtonText}>Scan Lagi</Text>
          </AnimatedButton>
        </ScrollView>

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
    <View style={{ flex: 1 }}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={handleBarcodeScanned}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.75)', 'transparent', 'rgba(0,0,0,0.85)']}
          style={styles.overlay}
        >
          <View style={styles.scanHeader}>
            <Pressable style={styles.closeButton} onPress={() => router.back()}>
              <Ionicons name="close-outline" size={28} color="#FFFFFF" />
            </Pressable>

            <Text style={styles.scanTitle}>Scan VC / VP JWT</Text>
            <Text style={styles.scanSubtitle}>
              Scan QR presentation atau credential JWT.
            </Text>
          </View>

          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>

          <Text style={styles.scanHint}>
            Arahkan kamera ke QR VP JWT atau VC JWT
          </Text>
        </LinearGradient>
      </CameraView>

      <LoadingOverlay visible={loading} message="Membaca QR..." />
    </View>
  );
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 54,
    paddingBottom: 54,
  },
  scanHeader: {
    alignItems: 'center',
    width: '100%',
  },
  closeButton: {
    alignSelf: 'flex-start',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 18,
  },
  scanSubtitle: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  scanFrame: {
    width: 260,
    height: 260,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderColor: '#FFFFFF',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderTopLeftRadius: 18,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderTopRightRadius: 18,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderBottomLeftRadius: 18,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderBottomRightRadius: 18,
  },
  scanHint: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  centerTitle: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 12,
  },
  centerText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
  },
  permissionButton: {
    backgroundColor: '#2563EB',
    marginTop: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
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
  },
  heroLabel: {
    fontSize: 14,
    color: '#E5E7EB',
    fontWeight: '900',
  },
  heroTitle: {
    fontSize: 26,
    color: '#FFFFFF',
    fontWeight: '900',
    marginTop: 2,
    maxWidth: 240,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#F3F4F6',
    marginTop: 8,
    lineHeight: 21,
    maxWidth: 235,
  },
  heroIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 18,
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  statusText: {
    flex: 1,
    fontWeight: '900',
    fontSize: 14,
    lineHeight: 20,
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
    marginBottom: 12,
  },
  sectionIconBlue: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconOrange: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '900',
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: '#2563EB',
    lineHeight: 20,
    fontWeight: '700',
  },
  presentedItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 10,
  },
  presentedLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '900',
  },
  presentedValue: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '900',
    marginTop: 5,
  },
  presentedMeta: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
    marginTop: 5,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  jsonText: {
    backgroundColor: '#F8FAFC',
    color: '#111827',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    padding: 12,
    borderRadius: 14,
  },
  jwtText: {
    backgroundColor: '#F8FAFC',
    color: '#2563EB',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    padding: 12,
    borderRadius: 14,
  },
  scanAgainButton: {
    backgroundColor: '#2563EB',
    marginTop: 18,
    borderRadius: 18,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  scanAgainButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
});