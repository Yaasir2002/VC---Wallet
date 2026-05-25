import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';

import {
  savePin,
  setBiometricEnabled,
  setOnboardingCompleted,
  setSessionUnlocked,
} from '../../src/Storage/authStorage';

export default function CreatePinScreen() {
  const router = useRouter();

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [error, setError] = useState('');

  async function toggleBiometric() {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      setError('Biometrik tidak tersedia di perangkat ini.');
      return;
    }

    setBiometricEnabledState(!biometricEnabled);
    setError('');
  }

  async function handleSave() {
    if (pin.length < 6) {
      setError('PIN minimal 6 digit.');
      return;
    }

    if (pin !== confirmPin) {
      setError('Konfirmasi PIN tidak sesuai.');
      return;
    }

    await savePin(pin);
    await setBiometricEnabled(biometricEnabled);
    await setOnboardingCompleted(true);
    await setSessionUnlocked(true);

    router.replace('/(tabs)');
  }

  return (
    <View style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LinearGradient
          colors={['#2563EB', '#1D4ED8', '#F97316']}
          style={styles.header}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="key-outline" size={42} color="#2563EB" />
          </View>

          <Text style={styles.headerTitle}>Buat PIN Wallet</Text>
          <Text style={styles.headerSubtitle}>
            PIN digunakan untuk membuka SSI Wallet dan melindungi credential
            yang tersimpan di perangkat.
          </Text>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.label}>PIN Baru</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            secureTextEntry
            maxLength={6}
            value={pin}
            onChangeText={(value) => {
              setPin(value.replace(/[^0-9]/g, ''));
              setError('');
            }}
            placeholder="••••••"
            placeholderTextColor="#9CA3AF"
            textAlign="center"
          />

          <Text style={styles.label}>Konfirmasi PIN</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            secureTextEntry
            maxLength={6}
            value={confirmPin}
            onChangeText={(value) => {
              setConfirmPin(value.replace(/[^0-9]/g, ''));
              setError('');
            }}
            placeholder="••••••"
            placeholderTextColor="#9CA3AF"
            textAlign="center"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            style={[
              styles.bioCard,
              biometricEnabled && styles.bioCardActive,
            ]}
            onPress={toggleBiometric}
          >
            <View style={styles.bioIcon}>
              <Ionicons
                name="finger-print-outline"
                size={24}
                color={biometricEnabled ? '#FFFFFF' : '#2563EB'}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.bioTitle,
                  biometricEnabled && styles.bioTextActive,
                ]}
              >
                Aktifkan Biometrik
              </Text>
              <Text
                style={[
                  styles.bioSubtitle,
                  biometricEnabled && styles.bioTextActive,
                ]}
              >
                Gunakan fingerprint/face unlock sebagai akses cepat ke wallet.
              </Text>
            </View>

            <Ionicons
              name={biometricEnabled ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={biometricEnabled ? '#FFFFFF' : '#9CA3AF'}
            />
          </Pressable>

          <Pressable style={styles.button} onPress={handleSave}>
            <Text style={styles.buttonText}>Simpan & Masuk Wallet</Text>
            <Ionicons name="arrow-forward-outline" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.noteCard}>
          <Ionicons name="shield-checkmark-outline" size={22} color="#F97316" />
          <Text style={styles.noteText}>
            PIN disimpan secara lokal menggunakan secure storage perangkat.
            Setelah PIN berhasil dibuat, wallet akan langsung dibuka.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    borderRadius: 30,
    padding: 26,
    alignItems: 'center',
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#DBEAFE',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginTop: 20,
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  label: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 10,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 14,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 8,
    color: '#111827',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 12,
  },
  bioCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 18,
    padding: 14,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  bioCardActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  bioIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111827',
  },
  bioSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 3,
    lineHeight: 17,
  },
  bioTextActive: {
    color: '#FFFFFF',
  },
  button: {
    backgroundColor: '#2563EB',
    padding: 15,
    borderRadius: 16,
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '900',
    fontSize: 15,
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