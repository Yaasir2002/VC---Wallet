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
        <View>
          <Text style={styles.heroLabel}>Verifier Mode</Text>
          <Text style={styles.heroTitle}>Scan & Verify</Text>
          <Text style={styles.heroSubtitle}>
            Scan Verifiable Presentation QR Code to validate credential data.
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
          Gunakan kamera untuk membaca QR Verifiable Presentation dari pengguna
          lain, lalu sistem akan melakukan validasi dasar terhadap VP dan VC.
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
          <Text style={styles.infoTitle}>Verification Flow</Text>
        </View>

        <View style={styles.stepItem}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <Text style={styles.stepText}>Scan QR Verifiable Presentation.</Text>
        </View>

        <View style={styles.stepItem}>
          <View style={styles.stepNumberOrange}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <Text style={styles.stepText}>Parse VP JSON from QR data.</Text>
        </View>

        <View style={styles.stepItem}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>3</Text>
          </View>
          <Text style={styles.stepText}>
            Validate holder, credential structure, issuer, subject, and proof.
          </Text>
        </View>
      </View>

      <View style={styles.noteCard}>
        <Ionicons name="information-circle-outline" size={22} color="#F97316" />
        <Text style={styles.noteText}>
          Verifier mode saat ini menggunakan basic verification. Pada tahap
          lanjutan, proses ini dapat dikembangkan dengan signature verification
          dan DID resolver.
        </Text>
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
    marginBottom: 14,
  },
  infoIconBlue: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '900',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 13,
    marginTop: 10,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberOrange: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  stepText: {
    flex: 1,
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
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
});