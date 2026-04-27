import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

import { VerifiableCredential } from '../../src/types/vc';
import { VerifiablePresentation } from '../../src/types/vp';
import { getVCById } from '../../src/Storage/vcStorage';
import { getDID } from '../../src/Storage/didStorage';
import { generateVP } from '../../src/Services/vpService';

import AppToast from '../../components/ui/AppToast';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import AnimatedButton from '../../components/ui/AnimatedButton';

export default function PresentCredentialScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [presentation, setPresentation] =
    useState<VerifiablePresentation | null>(null);
  const [presentationJson, setPresentationJson] = useState('');

  const [loading, setLoading] = useState(false);

  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'info',
  });

  async function loadPresentation() {
    try {
      setLoading(true);

      if (!id) return;

      const credential: VerifiableCredential | null = await getVCById(id);
      const didData = await getDID();

      if (!credential || !didData) {
        setToast({
          visible: true,
          message: 'Credential atau DID tidak ditemukan',
          type: 'error',
        });
        router.back();
        return;
      }

      const vp = generateVP(credential, didData.did);
      const json = JSON.stringify(vp, null, 2);

      setPresentation(vp);
      setPresentationJson(json);
    } catch {
      setToast({
        visible: true,
        message: 'Gagal membuat presentation',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    await Clipboard.setStringAsync(presentationJson);

    setToast({
      visible: true,
      message: 'Presentation JSON berhasil disalin',
      type: 'success',
    });
  }

  useEffect(() => {
    loadPresentation();
  }, [id]);

  if (!presentation) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Membuat presentation...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* BACK */}
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={20} color="#111827" />
          <Text style={styles.backText}>Kembali</Text>
        </Pressable>

        {/* HEADER */}
        <View style={styles.headerCard}>
          <View style={styles.iconCircle}>
            <Ionicons name="qr-code-outline" size={34} color="#FFFFFF" />
          </View>

          <Text style={styles.title}>Present Credential</Text>

          <Text style={styles.subtitle}>
            Verifiable Presentation digunakan untuk membagikan credential.
          </Text>
        </View>

        {/* QR */}
        <View style={styles.qrCard}>
          <Text style={styles.sectionTitle}>QR Presentation</Text>

          <View style={styles.qrBox}>
            <QRCode value={presentationJson} size={220} />
          </View>
        </View>

        {/* INFO */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Presentation Info</Text>

          <Text style={styles.label}>ID</Text>
          <Text style={styles.value}>{presentation.id}</Text>

          <Text style={styles.label}>Holder</Text>
          <Text style={styles.value}>{presentation.holder}</Text>
        </View>

        {/* JSON */}
        <View style={styles.sectionCard}>
          <View style={styles.jsonHeader}>
            <Text style={styles.sectionTitle}>Presentation JSON</Text>

            <AnimatedButton style={styles.copyButton} onPress={handleCopy}>
              <Ionicons name="copy-outline" size={16} color="#FFFFFF" />
              <Text style={styles.copyButtonText}>Copy</Text>
            </AnimatedButton>
          </View>

          <Text style={styles.jsonText}>{presentationJson}</Text>
        </View>
      </ScrollView>

      {/* LOADING */}
      <LoadingOverlay visible={loading} message="Membuat presentation..." />

      {/* TOAST */}
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
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  content: { padding: 20, paddingBottom: 40 },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: { color: '#6B7280' },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 6,
  },

  backText: { fontWeight: '700' },

  headerCard: {
    backgroundColor: '#111827',
    padding: 24,
    borderRadius: 20,
  },

  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },

  title: { color: '#fff', fontSize: 24, fontWeight: '800' },

  subtitle: { color: '#D1D5DB', marginTop: 6 },

  qrCard: {
    backgroundColor: '#fff',
    marginTop: 16,
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
  },

  qrBox: { marginTop: 12 },

  sectionCard: {
    backgroundColor: '#fff',
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
  },

  sectionTitle: { fontWeight: '800', fontSize: 16 },

  label: { marginTop: 8, color: '#6B7280', fontSize: 12 },

  value: { fontWeight: '600', fontSize: 14 },

  jsonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  copyButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },

  copyButtonText: { color: '#fff', fontWeight: '800' },

  jsonText: {
    marginTop: 12,
    fontSize: 12,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 10,
  },
});