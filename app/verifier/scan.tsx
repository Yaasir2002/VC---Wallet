import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

import {
  verifyVP,
  VPVerificationResult,
} from '../../src/Services/vpVerificationService';

export default function ScanPresentationScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const [scanned, setScanned] = useState(false);
  const [rawData, setRawData] = useState('');
  const [result, setResult] = useState<VPVerificationResult | null>(null);

  async function handleBarcodeScanned({ data }: { data: string }) {
    if (scanned) return;

    setScanned(true);
    setRawData(data);

    try {
      const parsed = JSON.parse(data);
      const verificationResult = verifyVP(parsed);
      setResult(verificationResult);
    } catch {
      Alert.alert('QR Tidak Valid', 'QR tidak berisi JSON presentation yang valid.');
      setResult(null);
    }
  }

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Memuat permission kamera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="camera-outline" size={54} color="#2563EB" />
        <Text style={styles.permissionTitle}>Izin Kamera Dibutuhkan</Text>
        <Text style={styles.permissionText}>
          Aplikasi membutuhkan akses kamera untuk scan QR Verifiable Presentation.
        </Text>

        <Pressable style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Izinkan Kamera</Text>
        </Pressable>
      </View>
    );
  }

  if (result) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={20} color="#111827" />
          <Text style={styles.backText}>Kembali</Text>
        </Pressable>

        <View
          style={[
            styles.resultCard,
            result.isValid ? styles.validCard : styles.invalidCard,
          ]}
        >
          <Ionicons
            name={
              result.isValid
                ? 'checkmark-circle-outline'
                : 'close-circle-outline'
            }
            size={48}
            color={result.isValid ? '#16A34A' : '#DC2626'}
          />

          <Text
            style={[
              styles.resultTitle,
              result.isValid ? styles.validText : styles.invalidText,
            ]}
          >
            {result.status}
          </Text>

          <Text style={styles.resultSubtitle}>
            Hasil verifikasi Verifiable Presentation dari QR Code.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Presentation Checks</Text>

          <Text style={styles.checkItem}>
            {result.vpChecks.structure ? '✅' : '❌'} Struktur VP
          </Text>
          <Text style={styles.checkItem}>
            {result.vpChecks.holder ? '✅' : '❌'} Holder DID
          </Text>
          <Text style={styles.checkItem}>
            {result.vpChecks.credential ? '✅' : '❌'} Credential tersedia
          </Text>
        </View>

        {result.vcResult && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Credential Checks</Text>

            <Text style={styles.checkItem}>
              {result.vcResult.checks.structure ? '✅' : '❌'} Struktur VC
            </Text>
            <Text style={styles.checkItem}>
              {result.vcResult.checks.issuer ? '✅' : '❌'} Issuer DID
            </Text>
            <Text style={styles.checkItem}>
              {result.vcResult.checks.subject ? '✅' : '❌'} Credential Subject
            </Text>
            <Text style={styles.checkItem}>
              {result.vcResult.checks.proof ? '✅' : '❌'} Proof
            </Text>
          </View>
        )}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Messages</Text>

          {result.messages.map((message, index) => (
            <Text key={index} style={styles.messageText}>
              • {message}
            </Text>
          ))}

          {result.vcResult?.messages.map((message, index) => (
            <Text key={`vc-${index}`} style={styles.messageText}>
              • {message}
            </Text>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Raw QR Data</Text>
          <Text style={styles.rawText}>{rawData}</Text>
        </View>

        <Pressable
          style={styles.scanAgainButton}
          onPress={() => {
            setScanned(false);
            setRawData('');
            setResult(null);
          }}
        >
          <Ionicons name="scan-outline" size={20} color="#FFFFFF" />
          <Text style={styles.scanAgainText}>Scan Lagi</Text>
        </Pressable>
      </ScrollView>
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
          <Ionicons name="close-outline" size={28} color="#FFFFFF" />
        </Pressable>

        <Text style={styles.scanTitle}>Scan Presentation QR</Text>
        <Text style={styles.scanSubtitle}>
          Arahkan kamera ke QR Verifiable Presentation.
        </Text>

        <View style={styles.scanFrame} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 15,
    color: '#6B7280',
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginTop: 14,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
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
    marginTop: 20,
  },
  scanTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 40,
  },
  scanSubtitle: {
    color: '#D1D5DB',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  scanFrame: {
    width: 260,
    height: 260,
    borderWidth: 4,
    borderColor: '#2563EB',
    borderRadius: 28,
    marginTop: 60,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    marginBottom: 16,
  },
  backText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  resultCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  validCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  invalidCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 10,
  },
  validText: {
    color: '#166534',
  },
  invalidText: {
    color: '#991B1B',
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 21,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  checkItem: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    marginTop: 6,
  },
  messageText: {
    fontSize: 13,
    color: '#374151',
    marginTop: 6,
    lineHeight: 19,
  },
  rawText: {
    fontSize: 12,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    lineHeight: 18,
  },
  scanAgainButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 15,
    borderRadius: 16,
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  scanAgainText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
});