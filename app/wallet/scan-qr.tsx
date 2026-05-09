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
  ParsedScannedCredential,
  parseCredentialFromQR,
  saveScannedCredential,
} from '../../src/Services/qrCredentialService';

type ToastState = {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
};

function getSafeErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();

  if (!message) {
    return fallback;
  }

  const unsafePatterns = [
    /stack/i,
    /token/i,
    /private/i,
    /secret/i,
    /key/i,
    /jwt/i,
    /file:\/\//i,
    /documentDirectory/i,
    /SecureStore/i,
    /AsyncStorage/i,
  ];

  if (unsafePatterns.some((pattern) => pattern.test(message))) {
    return fallback;
  }

  return message.slice(0, 160);
}

export default function ScanQRScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [isScanning, setIsScanning] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedCredential, setParsedCredential] =
    useState<ParsedScannedCredential | null>(null);

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
    if (!isScanning || isProcessing || parsedCredential) {
      return;
    }

    try {
      setIsScanning(false);
      setIsProcessing(true);

      const parsed = await parseCredentialFromQR(data);
      setParsedCredential(parsed);
    } catch (error) {
      setToast({
        visible: true,
        message: getSafeErrorMessage(error, 'QR tidak dapat diproses'),
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  }

  function handleResetScan() {
    setParsedCredential(null);
    setIsProcessing(false);
    setIsScanning(true);
  }

  async function handleSaveCredential() {
    if (!parsedCredential) {
      return;
    }

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

      await saveScannedCredential(parsedCredential);

      setToast({
        visible: true,
        message: 'Credential berhasil disimpan',
        type: 'success',
      });

      navigationTimeoutRef.current = setTimeout(() => {
        router.replace('/(tabs)/wallet');
      }, 700);
    } catch (error) {
      setToast({
        visible: true,
        message: getSafeErrorMessage(error, 'Gagal menyimpan credential'),
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
          Jika permission ditolak permanen, aktifkan kamera dari pengaturan
          aplikasi.
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
      {!parsedCredential ? (
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

            <Text style={styles.headerTitle}>Scan QR Credential</Text>

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
              Arahkan kamera ke QR credential atau credential offer.
            </Text>

            {isProcessing && (
              <View style={styles.processingBox}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.processingText}>Memproses QR...</Text>
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
              <Ionicons name="document-text-outline" size={34} color="#2563EB" />
            </View>

            <Text style={styles.credentialName}>
              {parsedCredential.preview.credentialName}
            </Text>

            <View style={styles.statusBadge}>
              <Ionicons
                name="alert-circle-outline"
                size={15}
                color="#C2410C"
              />
              <Text style={styles.statusBadgeText}>Pending Verification</Text>
            </View>

            <View style={styles.detailGroup}>
              <PreviewRow
                label="Issuer"
                value={parsedCredential.preview.issuer}
              />
              <PreviewRow
                label="Subject / Holder"
                value={parsedCredential.preview.subject}
              />
              <PreviewRow
                label="Tanggal Penerbitan"
                value={parsedCredential.preview.issuanceDate}
              />
              <PreviewRow
                label="Tanggal Kedaluwarsa"
                value={parsedCredential.preview.expirationDate ?? '-'}
              />
            </View>

            <Text style={styles.claimTitle}>Claim Utama</Text>

            {parsedCredential.preview.mainClaims.length === 0 ? (
              <Text style={styles.emptyClaimText}>
                Tidak ada claim utama yang dapat ditampilkan.
              </Text>
            ) : (
              parsedCredential.preview.mainClaims.map((claim) => (
                <View key={claim.label} style={styles.claimRow}>
                  <Text style={styles.claimLabel}>{claim.label}</Text>
                  <Text style={styles.claimValue}>{claim.value}</Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.securityNote}>
            <Ionicons name="shield-checkmark-outline" size={22} color="#2563EB" />
            <Text style={styles.securityNoteText}>
              Credential ini baru divalidasi secara struktur dasar. Statusnya
              disimpan sebagai pending_verification, bukan verified, sampai ada
              verifikasi cryptographic.
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
    left: 20,
    right: 20,
    bottom: 42,
    alignItems: 'center',
  },
  scanInstruction: {
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
  },
  processingBox: {
    marginTop: 18,
    backgroundColor: 'rgba(37, 99, 235, 0.9)',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  processingText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  retryButton: {
    marginTop: 18,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionIcon: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  permissionTitle: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  permissionText: {
    color: '#6B7280',
    fontWeight: '700',
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: '#2563EB',
    fontWeight: '900',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  previewContent: {
    padding: 20,
    paddingTop: 48,
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  credentialName: {
    color: '#111827',
    fontSize: 23,
    fontWeight: '900',
    marginTop: 16,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFEDD5',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusBadgeText: {
    color: '#C2410C',
    fontWeight: '900',
    fontSize: 12,
  },
  detailGroup: {
    marginTop: 18,
    gap: 12,
  },
  previewRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
  },
  previewLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '800',
  },
  previewValue: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
    lineHeight: 20,
  },
  claimTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 20,
  },
  emptyClaimText: {
    color: '#6B7280',
    fontWeight: '700',
    marginTop: 10,
  },
  claimRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 12,
  },
  claimLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '800',
  },
  claimValue: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
    lineHeight: 20,
  },
  securityNote: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 20,
    padding: 16,
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  securityNoteText: {
    flex: 1,
    color: '#1E40AF',
    fontWeight: '700',
    lineHeight: 19,
    fontSize: 13,
  },
  saveButton: {
    backgroundColor: '#2563EB',
    marginTop: 18,
    borderRadius: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#6B7280',
    fontWeight: '900',
  },
});