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
  resolveDID,
} from '../../src/Services/verificationService';

import AppToast from '../../components/ui/AppToast';
import AnimatedButton from '../../components/ui/AnimatedButton';
import LoadingOverlay from '../../components/ui/LoadingOverlay';

export default function ScanPresentationScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  const [rawJwt, setRawJwt] = useState('');
  const [verified, setVerified] = useState<boolean | null>(null);
  const [holderDid, setHolderDid] = useState('');
  const [didDocument, setDidDocument] = useState<any | null>(null);
  const [publicKeyInfo, setPublicKeyInfo] = useState<any | null>(null);

  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'info',
  });

  async function handleBarcodeScanned({ data }: { data: string }) {
    if (scanned) return;

    setScanned(true);
    setRawJwt(data);

    try {
      setLoading(true);

      const verificationResult = await verifyPresentationJWT(data);

      const isVerified = verificationResult.verified === true;
      setVerified(isVerified);

      const vpHolder =
        verificationResult?.verifiablePresentation?.holder ||
        verificationResult?.presentation?.holder ||
        verificationResult?.payload?.vp?.holder ||
        '';

      setHolderDid(vpHolder);

      if (!vpHolder) {
        setToast({
          visible: true,
          message: 'Holder DID tidak ditemukan pada VP JWT',
          type: 'error',
        });
        return;
      }

      const resolved = await resolveDID(vpHolder);
      const document = resolved?.didDocument;

      setDidDocument(document);

      const firstVerificationMethod =
        document?.verificationMethod?.[0] ||
        document?.authentication?.[0] ||
        document?.assertionMethod?.[0] ||
        null;

      setPublicKeyInfo(firstVerificationMethod);

      setToast({
        visible: true,
        message: isVerified
          ? 'Presentation berhasil diverifikasi'
          : 'Presentation tidak valid',
        type: isVerified ? 'success' : 'error',
      });
    } catch (error) {
      console.log('VERIFY VP JWT ERROR:', error);

      setVerified(false);

      setToast({
        visible: true,
        message: 'QR tidak valid atau JWT gagal diverifikasi',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  function handleScanAgain() {
    setScanned(false);
    setLoading(false);
    setRawJwt('');
    setVerified(null);
    setHolderDid('');
    setDidDocument(null);
    setPublicKeyInfo(null);
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
          Aplikasi membutuhkan akses kamera untuk scan QR Verifiable
          Presentation.
        </Text>

        <AnimatedButton style={styles.permissionButton} onPress={requestPermission}>
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
                {verified ? 'VALID VP JWT' : 'INVALID VP JWT'}
              </Text>
              <Text style={styles.heroSubtitle}>
                Hasil verifikasi presentation melalui JWT dan DID resolution.
              </Text>
            </View>

            <View style={styles.heroIcon}>
              <Ionicons
                name={verified ? 'checkmark-circle-outline' : 'close-circle-outline'}
                size={36}
                color={verified ? '#16A34A' : '#DC2626'}
              />
            </View>
          </LinearGradient>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBlue}>
                <Ionicons name="person-circle-outline" size={22} color="#2563EB" />
              </View>
              <Text style={styles.sectionTitle}>Holder DID</Text>
            </View>

            <Text style={styles.value}>{holderDid || '-'}</Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconOrange}>
                <Ionicons name="document-text-outline" size={22} color="#F97316" />
              </View>
              <Text style={styles.sectionTitle}>DID Document</Text>
            </View>

            {didDocument ? (
              <Text style={styles.jsonText}>
                {JSON.stringify(didDocument, null, 2)}
              </Text>
            ) : (
              <Text style={styles.emptyText}>DID Document tidak ditemukan.</Text>
            )}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBlue}>
                <Ionicons name="key-outline" size={22} color="#2563EB" />
              </View>
              <Text style={styles.sectionTitle}>Public Key / Verification Method</Text>
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
                <Ionicons name="qr-code-outline" size={22} color="#F97316" />
              </View>
              <Text style={styles.sectionTitle}>Raw VP JWT</Text>
            </View>

            <Text style={styles.jwtText}>{rawJwt}</Text>
          </View>

          <AnimatedButton style={styles.scanAgainButton} onPress={handleScanAgain}>
            <Ionicons name="scan-outline" size={20} color="#FFFFFF" />
            <Text style={styles.scanAgainText}>Scan Lagi</Text>
          </AnimatedButton>
        </ScrollView>

        <LoadingOverlay visible={loading} message="Memverifikasi VP JWT..." />

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
    <View style={styles.cameraContainer}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      />

      <View style={styles.overlay}>
        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <Ionicons name="close-outline" size={30} color="#FFFFFF" />
        </Pressable>

        <Text style={styles.scanTitle}>Scan VP JWT</Text>
        <Text style={styles.scanSubtitle}>
          Arahkan kamera ke QR Verifiable Presentation berbentuk JWT.
        </Text>

        <View style={styles.scanFrame}>
          <View style={styles.cornerTopLeft} />
          <View style={styles.cornerTopRight} />
          <View style={styles.cornerBottomLeft} />
          <View style={styles.cornerBottomRight} />
        </View>
      </View>

      <LoadingOverlay visible={loading} message="Memverifikasi VP JWT..." />

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
    color: '#111827',
    fontWeight: '900',
    marginTop: 14,
    textAlign: 'center',
  },
  centerText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 18,
  },
  permissionButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  overlay: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  closeButton: {
    alignSelf: 'flex-start',
    marginTop: 18,
  },
  scanTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 42,
  },
  scanSubtitle: {
    color: '#D1D5DB',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  scanFrame: {
    width: 270,
    height: 270,
    marginTop: 60,
    position: 'relative',
  },
  cornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 60,
    height: 60,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderColor: '#F97316',
    borderTopLeftRadius: 24,
  },
  cornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 60,
    height: 60,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderColor: '#F97316',
    borderTopRightRadius: 24,
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 60,
    height: 60,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderColor: '#F97316',
    borderBottomLeftRadius: 24,
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 60,
    height: 60,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderColor: '#F97316',
    borderBottomRightRadius: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  backText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '800',
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
    color: '#FFEDD5',
    fontWeight: '900',
  },
  heroTitle: {
    fontSize: 27,
    color: '#FFFFFF',
    fontWeight: '900',
    marginTop: 2,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#DBEAFE',
    marginTop: 8,
    lineHeight: 21,
    maxWidth: 230,
    fontWeight: '700',
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
    marginBottom: 10,
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
    fontSize: 13,
    color: '#2563EB',
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
  emptyText: {
    color: '#6B7280',
    fontWeight: '700',
    fontSize: 13,
  },
  scanAgainButton: {
    backgroundColor: '#2563EB',
    marginTop: 18,
    paddingVertical: 15,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  scanAgainText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
});