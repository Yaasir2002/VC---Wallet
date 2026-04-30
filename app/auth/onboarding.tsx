import { useState } from 'react';
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
import { setOnboardingCompleted } from '../../src/Storage/authStorage';

const slides = [
  {
    icon: 'shield-checkmark-outline',
    title: 'SSI Wallet',
    subtitle:
      'Kelola identitas digital berbasis DID dan Verifiable Credential secara aman di perangkatmu.',
  },
  {
    icon: 'finger-print-outline',
    title: 'Decentralized Identity',
    subtitle:
      'Buat DID did:ethr untuk mengontrol identitas digital tanpa bergantung pada akun terpusat.',
  },
  {
    icon: 'id-card-outline',
    title: 'Modular Credential',
    subtitle:
      'Simpan credential secara modular, satu atribut untuk satu credential agar mudah dipresentasikan.',
  },
  {
    icon: 'qr-code-outline',
    title: 'Present as QR',
    subtitle:
      'Presentasikan credential dalam bentuk JWT yang diubah menjadi QR Code untuk diverifikasi pihak ketiga.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [index, setIndex] = useState(0);

  const slide = slides[index];
  const isLast = index === slides.length - 1;

  async function handleNext() {
    if (!isLast) {
      setIndex(index + 1);
      return;
    }

    await setOnboardingCompleted(true);
    router.replace('/auth/create-pin');
  }

  async function handleSkip() {
    await setOnboardingCompleted(true);
    router.replace('/auth/create-pin');
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2563EB', '#1D4ED8', '#F97316']}
        style={styles.hero}
      >
        <View style={styles.topRow}>
          <Text style={styles.brand}>VC Wallet</Text>

          {!isLast && (
            <Pressable onPress={handleSkip}>
              <Text style={styles.skipText}>Lewati</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.iconCircle}>
          <Ionicons name={slide.icon as any} size={54} color="#2563EB" />
        </View>

        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.subtitle}</Text>

        <View style={styles.dots}>
          {slides.map((_, itemIndex) => (
            <View
              key={itemIndex}
              style={[
                styles.dot,
                itemIndex === index && styles.activeDot,
              ]}
            />
          ))}
        </View>
      </LinearGradient>

      <View style={styles.bottomCard}>
        <Text style={styles.infoTitle}>
          {isLast ? 'Siap Mengamankan Wallet?' : 'Identitas Digital Aman'}
        </Text>

        <Text style={styles.infoText}>
          Setelah onboarding, kamu akan membuat PIN lokal untuk mengunci wallet.
          PIN disimpan pada secure storage perangkat.
        </Text>

        <Pressable style={styles.primaryButton} onPress={handleNext}>
          <Text style={styles.primaryButtonText}>
            {isLast ? 'Mulai Sekarang' : 'Lanjut'}
          </Text>
          <Ionicons name="arrow-forward-outline" size={20} color="#FFFFFF" />
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
  skipText: {
    color: '#FFEDD5',
    fontSize: 14,
    fontWeight: '800',
  },
  iconCircle: {
    width: 122,
    height: 122,
    borderRadius: 61,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 82,
    marginBottom: 28,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: '#DBEAFE',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 310,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 34,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  activeDot: {
    width: 28,
    backgroundColor: '#FFFFFF',
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
});