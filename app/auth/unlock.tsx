import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';

import {
  getPin,
  isBiometricEnabled,
  setSessionUnlocked,
} from '../../src/Storage/authStorage';
import AnimatedButton from '../../components/ui/AnimatedButton';
import AppToast from '../../components/ui/AppToast';

export default function UnlockScreen() {
  const router = useRouter();

  const [inputPin, setInputPin] = useState('');
  const [savedPin, setSavedPin] = useState<string | null>(null);

  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'info',
  });

  useEffect(() => {
    loadPin();
  }, []);

  async function loadPin() {
    const pin = await getPin();
    setSavedPin(pin);
  }

  async function handleBiometric() {
  const biometricEnabled = await isBiometricEnabled();

  if (!biometricEnabled) {
    setToast({
      visible: true,
      message: 'Biometrik belum diaktifkan pada wallet ini',
      type: 'error',
    });
    return;
  }

  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (!hasHardware || !isEnrolled) {
    setToast({
      visible: true,
      message: 'Biometrik tidak tersedia di perangkat ini',
      type: 'error',
    });
    return;
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock VC Wallet',
    cancelLabel: 'Batal',
  });

    if (result.success) {
    await setSessionUnlocked(true);
    router.replace('/(tabs)');
  }
}

  async function handleUnlock() {
  if (!inputPin) {
    setToast({
      visible: true,
      message: 'Masukkan PIN terlebih dahulu',
      type: 'error',
    });
    return;
  }

  if (inputPin === savedPin) {
    await setSessionUnlocked(true);
    router.replace('/(tabs)');
  } else {
    setToast({
      visible: true,
      message: 'PIN salah',
      type: 'error',
    });
    setInputPin('');
  }
}

  return (
    <View style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LinearGradient
          colors={['#2563EB', '#1D4ED8', '#F97316']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.logoCircle}>
            <Ionicons name="lock-closed-outline" size={40} color="#2563EB" />
          </View>

          <Text style={styles.headerTitle}>Unlock Wallet</Text>
          <Text style={styles.headerSubtitle}>
            Masukkan PIN atau gunakan biometrik untuk membuka VC Wallet.
          </Text>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.label}>PIN Wallet</Text>

          <TextInput
            style={styles.input}
            keyboardType="numeric"
            secureTextEntry
            maxLength={6}
            value={inputPin}
            onChangeText={setInputPin}
            placeholder="••••••"
            placeholderTextColor="#9CA3AF"
            textAlign="center"
          />

          <AnimatedButton style={styles.unlockButton} onPress={handleUnlock}>
            <Ionicons name="key-outline" size={20} color="#FFFFFF" />
            <Text style={styles.unlockButtonText}>Unlock</Text>
          </AnimatedButton>

          <Pressable style={styles.bioButton} onPress={handleBiometric}>
            <Ionicons name="finger-print-outline" size={22} color="#2563EB" />
            <Text style={styles.bioButtonText}>Gunakan Biometrik</Text>
          </Pressable>
        </View>

        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark-outline" size={22} color="#F97316" />
          <Text style={styles.securityText}>
            Wallet dilindungi dengan PIN lokal dan autentikasi biometrik.
          </Text>
        </View>
      </KeyboardAvoidingView>

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
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    borderRadius: 30,
    padding: 26,
    alignItems: 'center',
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
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
  unlockButton: {
    backgroundColor: '#2563EB',
    marginTop: 18,
    borderRadius: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  unlockButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  bioButton: {
    backgroundColor: '#EFF6FF',
    marginTop: 12,
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  bioButtonText: {
    color: '#2563EB',
    fontWeight: '900',
    fontSize: 14,
  },
  securityNote: {
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
  securityText: {
    flex: 1,
    color: '#9A3412',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});