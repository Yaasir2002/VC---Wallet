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
      : 'QR berisi VP JWT dan berhasil dibaca oleh sistem.';
  }

  if (result.kind === 'vc-jwt') {
    return result.signatureVerified
      ? 'QR berisi VC JWT signed dan signature terverifikasi.'
      : 'QR berisi VC JWT dan berhasil dibaca oleh sistem.';
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

function getReadablePayloadKind(kind?: string) {
  if (kind === 'vp-jwt') return 'Verifiable Presentation JWT';
  if (kind === 'vc-jwt') return 'Verifiable Credential JWT';

  return 'Unknown Payload';
}

function getSignatureStatus(value?: boolean) {
  return value ? 'Signature valid' : 'Signature belum valid';
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
            <View style={styles.resultHeroText}>
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
                size={38}
                color={verified ? '#16A34A' : '#DC2626'}
              />
            </View>
          </LinearGradient>

          <View
            style={[
              styles.statusCard,
              verified ? styles.successStatusCard : styles.errorStatusCard,
            ]}
          >
            <Ionicons
              name={verified ? 'shield-checkmark-outline' : 'warning-outline'}
              size={23}
              color={verified ? '#16A34A' : '#DC2626'}
            />

            <Text
              style={[
                styles.statusText,
                { color: verified ? '#166534' : '#991B1B' },
              ]}
            >
              {verified
                ? 'Data berhasil dibaca dan hasil validasi tersedia di bawah.'
                : verificationResult?.warning ||
                  'QR gagal diverifikasi atau tidak dapat dibaca.'}
            </Text>
          </View>

          <View style={styles.validationCard}>
            <View style={styles.cardHeader}>
              <View
                style={[
                  styles.cardIcon,
                  verified ? styles.iconSuccess : styles.iconDanger,
                ]}
              >
                <Ionicons
                  name="documents-outline"
                  size={24}
                  color={verified ? '#16A34A' : '#DC2626'}
                />
              </View>

              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>VP Verification</Text>
                <Text style={styles.cardSubtitle}>
                  Ringkasan hasil validasi Verifiable Presentation.
                </Text>
              </View>
            </View>

            <View style={styles.compactInfoList}>
              <View style={styles.compactInfoRow}>
                <Text style={styles.compactInfoLabel}>Jenis Data</Text>
                <Text style={styles.compactInfoValue}>
                  {getReadablePayloadKind(verificationResult?.kind)}
                </Text>
              </View>

              <View style={styles.compactInfoRow}>
                <Text style={styles.compactInfoLabel}>Signature VP</Text>
                <Text
                  style={[
                    styles.compactInfoValue,
                    {
                      color: verificationResult?.signatureVerified
                        ? '#166534'
                        : '#991B1B',
                    },
                  ]}
                >
                  {getSignatureStatus(verificationResult?.signatureVerified)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.validationCard}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, styles.iconBlue]}>
                <Ionicons name="id-card-outline" size={24} color="#2563EB" />
              </View>

              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>VC Verification</Text>
                <Text style={styles.cardSubtitle}>
                  Holder dan credential yang berhasil dibaca dari presentation.
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.resultBadge,
                presentedCredentials.length > 0 && verified
                  ? styles.badgeSuccess
                  : styles.badgeNeutral,
              ]}
            >
              <Ionicons
                name={
                  presentedCredentials.length > 0 && verified
                    ? 'checkmark-circle'
                    : 'information-circle'
                }
                size={16}
                color={
                  presentedCredentials.length > 0 && verified
                    ? '#16A34A'
                    : '#6B7280'
                }
              />
              <Text
                style={[
                  styles.resultBadgeText,
                  {
                    color:
                      presentedCredentials.length > 0 && verified
                        ? '#166534'
                        : '#374151',
                  },
                ]}
              >
                {presentedCredentials.length > 0 && verified
                  ? 'VC tersedia dan tervalidasi'
                  : 'VC tidak tersedia'}
              </Text>
            </View>

            <View style={styles.holderBox}>
              <View style={styles.holderHeader}>
                <View style={styles.holderIcon}>
                  <Ionicons
                    name="person-circle-outline"
                    size={22}
                    color="#2563EB"
                  />
                </View>

                <View style={styles.holderHeaderText}>
                  <Text style={styles.holderTitle}>Holder / Subject DID</Text>
                  <Text style={styles.holderSubtitle}>
                    Identitas digital pemilik credential.
                  </Text>
                </View>
              </View>

              <Text style={styles.didValue}>{holderDid || '-'}</Text>
            </View>

            <View style={styles.credentialSection}>
              <View style={styles.credentialSectionHeader}>
                <Ionicons name="reader-outline" size={20} color="#2563EB" />
                <Text style={styles.credentialSectionTitle}>
                  Data Credential
                </Text>
              </View>

              {presentedCredentials.length > 0 ? (
                presentedCredentials.map((credential, index) => (
                  <View key={index} style={styles.presentedItem}>
                    {credential.error ? (
                      <>
                        <Text style={styles.presentedLabel}>
                          Credential Error
                        </Text>
                        <Text style={styles.presentedValue}>
                          {credential.error}
                        </Text>
                      </>
                    ) : (
                      <>
                        <View style={styles.credentialTopRow}>
                          <View style={styles.credentialAvatar}>
                            <Ionicons
                              name="person-outline"
                              size={22}
                              color="#2563EB"
                            />
                          </View>

                          <View style={styles.credentialIdentity}>
                            <Text style={styles.presentedLabel}>
                              {credential.attributeName || 'Credential'}
                            </Text>
                            <Text style={styles.presentedValue}>
                              {credential.attributeValue || '-'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.credentialDetailList}>
                          <View style={styles.credentialDetailItem}>
                            <Text style={styles.presentedMetaLabel}>Type</Text>
                            <Text style={styles.presentedMetaValue}>
                              {credential.attributeType || '-'}
                            </Text>
                          </View>

                          <View style={styles.credentialDetailItem}>
                            <Text style={styles.presentedMetaLabel}>Issuer</Text>
                            <Text style={styles.presentedMetaValue}>
                              {shorten(credential.issuer)}
                            </Text>
                          </View>

                          <View style={styles.credentialDetailItem}>
                            <Text style={styles.presentedMetaLabel}>Subject</Text>
                            <Text style={styles.presentedMetaValue}>
                              {shorten(credential.subject)}
                            </Text>
                          </View>

                          <View style={styles.credentialDetailItem}>
                            <Text style={styles.presentedMetaLabel}>
                              Issued At
                            </Text>
                            <Text style={styles.presentedMetaValue}>
                              {String(credential.issuanceDate || '-')}
                            </Text>
                          </View>
                        </View>
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
  resultHeroText: {
    flex: 1,
    paddingRight: 14,
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
  },
  successStatusCard: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  errorStatusCard: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  statusText: {
    flex: 1,
    fontWeight: '800',
    lineHeight: 20,
  },
  validationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSuccess: {
    backgroundColor: '#DCFCE7',
  },
  iconDanger: {
    backgroundColor: '#FEE2E2',
  },
  iconBlue: {
    backgroundColor: '#DBEAFE',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    lineHeight: 19,
    marginTop: 3,
  },
  compactInfoList: {
    gap: 10,
  },
  compactInfoRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  compactInfoLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '800',
    marginBottom: 5,
  },
  compactInfoValue: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 20,
  },
  resultBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 14,
  },
  badgeSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  badgeNeutral: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  resultBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  holderBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
  },
  holderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  holderIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  holderHeaderText: {
    flex: 1,
  },
  holderTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },
  holderSubtitle: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 2,
  },
  didValue: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
  },
  credentialSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
  },
  credentialSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  credentialSectionTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },
  presentedItem: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  credentialTopRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  credentialAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  credentialIdentity: {
    flex: 1,
  },
  presentedLabel: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  presentedValue: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '900',
  },
  credentialDetailList: {
    gap: 8,
  },
  credentialDetailItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  presentedMetaLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 3,
  },
  presentedMetaValue: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  emptyText: {
    color: '#6B7280',
    fontWeight: '700',
    lineHeight: 20,
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