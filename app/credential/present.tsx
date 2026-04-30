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
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

import { getVCById } from '../../src/Storage/vcStorage';
import { getDID } from '../../src/Storage/didStorage';
import { ModularCredential } from '../../src/types/vc';
import { createSignedPresentationJWT } from '../../src/Services/presentationService';

import AppToast from '../../components/ui/AppToast';
import AnimatedButton from '../../components/ui/AnimatedButton';
import LoadingOverlay from '../../components/ui/LoadingOverlay';

export default function PresentCredentialScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [credential, setCredential] = useState<ModularCredential | null>(null);
  const [presentationJwt, setPresentationJwt] = useState('');
  const [loading, setLoading] = useState(false);

  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'info',
  });

  async function loadPresentation() {
    try {
      setLoading(true);

      if (!id) {
        setToast({
          visible: true,
          message: 'Credential ID tidak ditemukan',
          type: 'error',
        });
        return;
      }

      const selectedCredential = await getVCById(id);
      const didData = await getDID();

      if (!selectedCredential) {
        setToast({
          visible: true,
          message: 'Credential tidak ditemukan',
          type: 'error',
        });
        router.back();
        return;
      }

      if (!didData?.did) {
        setToast({
          visible: true,
          message: 'DID belum tersedia',
          type: 'error',
        });
        router.back();
        return;
      }

      const vp = await createSignedPresentationJWT({
        holderDid: didData.did,
        credentials: [selectedCredential],
      });

      setCredential(selectedCredential);
      setPresentationJwt(vp.jwt);
    } catch (error) {
      console.log('CREATE VP JWT ERROR:', error);

      setToast({
        visible: true,
        message: 'Gagal membuat presentation JWT',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyJWT() {
    if (!presentationJwt) return;

    await Clipboard.setStringAsync(presentationJwt);

    setToast({
      visible: true,
      message: 'VP JWT berhasil disalin',
      type: 'success',
    });
  }

  useEffect(() => {
    loadPresentation();
  }, [id]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={20} color="#111827" />
          <Text style={styles.backText}>Kembali</Text>
        </Pressable>

        <LinearGradient
          colors={['#2563EB', '#1D4ED8', '#F97316']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View>
            <Text style={styles.heroLabel}>Present Credential</Text>
            <Text style={styles.heroTitle}>Signed VP JWT</Text>
            <Text style={styles.heroSubtitle}>
              Credential dipresentasikan sebagai JWT yang ditandatangani dan
              diubah menjadi QR Code.
            </Text>
          </View>

          <View style={styles.heroIcon}>
            <Ionicons name="qr-code-outline" size={36} color="#2563EB" />
          </View>
        </LinearGradient>

        {presentationJwt ? (
          <>
            <View style={styles.qrCard}>
              <Text style={styles.sectionTitle}>QR Presentation</Text>

              <View style={styles.qrBox}>
                <QRCode value={presentationJwt} size={220} />
              </View>

              <Text style={styles.qrNote}>
                QR ini berisi Verifiable Presentation dalam format JWT.
              </Text>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconBlue}>
                  <Ionicons name="id-card-outline" size={22} color="#2563EB" />
                </View>
                <Text style={styles.sectionTitle}>Credential Presented</Text>
              </View>

              <Text style={styles.label}>Credential ID</Text>
              <Text style={styles.value}>{credential?.id ?? '-'}</Text>

              <Text style={styles.label}>Attribute</Text>
              <Text style={styles.value}>
                {credential?.credentialSubject.attributeName ?? '-'}
              </Text>

              <Text style={styles.label}>Value</Text>
              <Text style={styles.value}>
                {credential?.credentialSubject.attributeValue ?? '-'}
              </Text>

              <Text style={styles.label}>Issuer</Text>
              <Text style={styles.value}>{credential?.issuer ?? '-'}</Text>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.jwtHeader}>
                <Text style={styles.sectionTitle}>VP JWT</Text>

                <AnimatedButton style={styles.copyButton} onPress={handleCopyJWT}>
                  <Ionicons name="copy-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.copyButtonText}>Copy</Text>
                </AnimatedButton>
              </View>

              <Text style={styles.jwtText}>{presentationJwt}</Text>
            </View>

            <View style={styles.noteCard}>
              <Ionicons
                name="information-circle-outline"
                size={22}
                color="#F97316"
              />
              <Text style={styles.noteText}>
                JWT ini akan diverifikasi oleh verifier menggunakan DID
                resolution untuk mengambil DID Document dan public key.
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="hourglass-outline" size={40} color="#2563EB" />
            <Text style={styles.emptyTitle}>Menyiapkan Presentation</Text>
            <Text style={styles.emptyText}>
              Sistem sedang membuat VP JWT untuk credential yang dipilih.
            </Text>
          </View>
        )}
      </ScrollView>

      <LoadingOverlay visible={loading} message="Membuat VP JWT..." />

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
  hero: {
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
    fontSize: 30,
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
  },
  heroIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 20,
    marginTop: 14,
  },
  qrNote: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 12,
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
    marginBottom: 6,
  },
  sectionIconBlue: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '900',
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '900',
    marginTop: 12,
  },
  value: {
    fontSize: 14,
    color: '#111827',
    marginTop: 5,
    lineHeight: 20,
    fontWeight: '700',
  },
  jwtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  copyButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  jwtText: {
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    color: '#2563EB',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    padding: 12,
    borderRadius: 14,
  },
  noteCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 20,
    padding: 16,
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  noteText: {
    flex: 1,
    color: '#9A3412',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    color: '#111827',
    fontWeight: '900',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
  },
});