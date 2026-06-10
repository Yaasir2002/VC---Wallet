import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import AnimatedButton from '../../components/ui/AnimatedButton';

export default function VerifierScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <LinearGradient
        colors={['#2563EB', '#1D4ED8', '#F97316']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTextWrapper}>
          <Text style={styles.heroLabel}>Verifier Mode</Text>
          <Text style={styles.heroTitle}>Scan & Verify</Text>
          <Text style={styles.heroSubtitle}>
            Scan QR Verifiable Presentation untuk memeriksa data credential secara cepat.
          </Text>
        </View>

        <View style={styles.heroIcon}>
          <Ionicons name="scan-outline" size={36} color="#2563EB" />
        </View>
      </LinearGradient>

      <View style={styles.mainCard}>
        <View style={styles.scanIconWrapper}>
          <View style={styles.scanIcon}>
            <Ionicons name="qr-code-outline" size={48} color="#2563EB" />
          </View>
        </View>

        <Text style={styles.title}>Ready to Verify</Text>

        <Text style={styles.subtitle}>
          Gunakan kamera untuk membaca QR Verifiable Presentation dari pengguna lain.
          Setelah QR terbaca, sistem akan menampilkan hasil verifikasi VP dan VC.
        </Text>

        <AnimatedButton
          style={styles.primaryButton}
          onPress={() => router.push('/verifier/scan')}
        >
          <Ionicons name="camera-outline" size={21} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Scan QR Presentation</Text>
        </AnimatedButton>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <View style={styles.infoIconBlue}>
            <Ionicons name="shield-checkmark-outline" size={22} color="#2563EB" />
          </View>

          <View style={styles.infoHeaderText}>
            <Text style={styles.infoTitle}>Verification Flow</Text>
            <Text style={styles.infoSubtitle}>
              Alur sederhana saat verifier memeriksa credential.
            </Text>
          </View>
        </View>

        <View style={styles.flowContainer}>
          <View style={styles.stepItem}>
            <View style={styles.stepLeft}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepLine} />
            </View>

            <View style={styles.stepContent}>
              <View style={styles.stepTitleRow}>
                <Ionicons name="camera-outline" size={18} color="#2563EB" />
                <Text style={styles.stepTitle}>Scan QR</Text>
              </View>
              <Text style={styles.stepText}>
                Verifier membuka kamera dan memindai QR Verifiable Presentation dari pengguna.
              </Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepLeft}>
              <View style={styles.stepNumberOrange}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepLineOrange} />
            </View>

            <View style={styles.stepContent}>
              <View style={styles.stepTitleRow}>
                <Ionicons name="document-text-outline" size={18} color="#F97316" />
                <Text style={styles.stepTitle}>Read Presentation</Text>
              </View>
              <Text style={styles.stepText}>
                Sistem membaca data VP dari QR, lalu mengambil credential yang dikirimkan holder.
              </Text>
            </View>
          </View>

          <View style={styles.stepItemLast}>
            <View style={styles.stepLeft}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
            </View>

            <View style={styles.stepContent}>
              <View style={styles.stepTitleRow}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#2563EB" />
                <Text style={styles.stepTitle}>Show Result</Text>
              </View>
              <Text style={styles.stepText}>
                Hasil verifikasi ditampilkan agar verifier dapat melihat status VP dan VC dengan jelas.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 1,
    paddingBottom: 40,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 20,
  },
  hero: {
    borderRadius: 28,
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTextWrapper: {
    flex: 1,
    paddingRight: 14,
  },
  heroLabel: {
    fontSize: 14,
    color: '#FFEDD5',
    fontWeight: '900',
  },
  heroTitle: {
    fontSize: 31,
    color: '#FFFFFF',
    fontWeight: '900',
    marginTop: 2,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#DBEAFE',
    marginTop: 8,
    lineHeight: 21,
    maxWidth: 250,
  },
  heroIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
  },
  scanIconWrapper: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  scanIcon: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    color: '#111827',
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 22,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  infoIconBlue: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoHeaderText: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '900',
  },
  infoSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 2,
  },
  flowContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 14,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingBottom: 16,
  },
  stepItemLast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepLeft: {
    alignItems: 'center',
  },
  stepNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberOrange: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  stepLine: {
    width: 2,
    flex: 1,
    minHeight: 42,
    backgroundColor: '#BFDBFE',
    marginTop: 6,
  },
  stepLineOrange: {
    width: 2,
    flex: 1,
    minHeight: 42,
    backgroundColor: '#FED7AA',
    marginTop: 6,
  },
  stepContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 6,
  },
  stepTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
  },
  stepText: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});