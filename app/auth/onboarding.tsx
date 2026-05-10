import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function OnboardingScreen() {
  const router = useRouter();

  function handleStart() {
    router.replace('/auth/create-account');
  }

  function handleRestoreWallet() {
    router.push('/auth/restore-wallet');
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2563EB', '#1D4ED8', '#F97316']}
        style={styles.hero}
      >
        <View style={styles.topRow}>
          <Text style={styles.brand}>SSI Wallet</Text>
        </View>

        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark-outline" size={58} color="#2563EB" />
        </View>

        <Text style={styles.title}>Kelola Identitas Digitalmu</Text>

        <Text style={styles.subtitle}>
          SSI Wallet membantu kamu membuat DID, menyimpan Verifiable Credential,
          dan mempresentasikan identitas digital secara aman melalui perangkatmu.
        </Text>
      </LinearGradient>

      <View style={styles.bottomCard}>
        <Text style={styles.infoTitle}>Mulai dengan Identitas Digital</Text>

        <Text style={styles.infoText}>
          Setelah onboarding, kamu dapat membuat wallet baru dengan recovery
          phrase atau memulihkan wallet lama menggunakan 12 kata recovery phrase.
        </Text>

        <Pressable style={styles.primaryButton} onPress={handleStart}>
          <Text style={styles.primaryButtonText}>Mulai Sekarang</Text>
          <Ionicons name="arrow-forward-outline" size={20} color="#FFFFFF" />
        </Pressable>

        <Pressable style={styles.restoreButton} onPress={handleRestoreWallet}>
          <Ionicons name="refresh-outline" size={20} color="#2563EB" />
          <Text style={styles.restoreButtonText}>Restore Wallet</Text>
        </Pressable>
      </View>
    </View>
  );
}

const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  hero: {
    minHeight: height * 0.68,
    padding: 24,
    paddingTop: 54,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    alignItems: 'center',
  },
  topRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  iconCircle: {
    width: 122,
    height: 122,
    borderRadius: 61,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 92,
    marginBottom: 28,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 38,
  },
  subtitle: {
    color: '#DBEAFE',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 320,
  },
  bottomCard: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    marginTop: -38,
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 21,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 18,
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  restoreButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 18,
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  restoreButtonText: {
    color: '#2563EB',
    fontWeight: '900',
    fontSize: 15,
  },
});