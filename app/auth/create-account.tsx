import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { saveUserProfile } from '../../src/Storage/profileStorage';
import { setOnboardingCompleted } from '../../src/Storage/authStorage';
import { getDID, saveDID } from '../../src/Storage/didStorage';
import { generateEthrDID } from '../../src/Services/didService';
import { safeLogger } from '../../src/utils/safeLogger';

export default function CreateAccountScreen() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const birthDateText = birthDate ? formatDate(birthDate) : '';

  async function handleCreateAccount() {
    if (!fullName.trim()) {
      Alert.alert('Validasi', 'Nama lengkap wajib diisi.');
      return;
    }

    if (!birthDate) {
      Alert.alert('Validasi', 'Tanggal lahir wajib diisi.');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Validasi', 'Email wajib diisi.');
      return;
    }

    if (!isValidEmail(email.trim())) {
      Alert.alert('Validasi', 'Format email tidak valid.');
      return;
    }

    if (!phoneNumber.trim()) {
      Alert.alert('Validasi', 'Nomor HP wajib diisi.');
      return;
    }

    if (!isValidPhoneNumber(phoneNumber.trim())) {
      Alert.alert(
        'Validasi',
        'Nomor HP harus diawali 08 dan berisi 10 sampai 15 digit.'
      );
      return;
    }

    if (!address.trim()) {
      Alert.alert('Validasi', 'Alamat wajib diisi.');
      return;
    }

    try {
      setLoading(true);

      const existingDID = await getDID();
      const finalDID = existingDID ?? (await generateEthrDID());

      if (!existingDID) {
        await saveDID(finalDID);
      }

      await saveUserProfile({
        fullName: fullName.trim(),
        birthDate: birthDate.toISOString(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
        address: address.trim(),
        profileImageUri: undefined,
        createdAt: new Date().toISOString(),
      });

      await setOnboardingCompleted(true);

      router.replace('/auth/create-pin');
    } catch (error) {
      safeLogger.error('Failed to create account');

      Alert.alert(
        'Gagal Membuat Akun',
        'Akun gagal dibuat karena DID tidak berhasil dibuat. Silakan coba lagi.'
      );
    } finally {
      setLoading(false);
    }
  }

  function handleDateChange(_: any, selectedDate?: Date) {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }

    if (selectedDate) {
      setBirthDate(selectedDate);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="person-add-outline" size={34} color="#2563EB" />
        </View>

        <Text style={styles.title}>Buat Akun Wallet</Text>
        <Text style={styles.subtitle}>
          Lengkapi data akun. DID akan otomatis dibuat saat akun berhasil
          disimpan.
        </Text>
      </View>

      <View style={styles.formCard}>
        <InputField
          label="Nama Lengkap"
          placeholder="Masukkan nama lengkap"
          value={fullName}
          onChangeText={setFullName}
          icon="person-outline"
        />

        <Text style={styles.label}>Tanggal Lahir</Text>
        <Pressable
          style={styles.dateInput}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar-outline" size={20} color="#64748B" />
          <Text
            style={[
              styles.dateText,
              !birthDateText && styles.placeholderText,
            ]}
          >
            {birthDateText || 'Pilih tanggal lahir'}
          </Text>
        </Pressable>

        {showDatePicker && (
          <DateTimePicker
            value={birthDate ?? new Date(2000, 0, 1)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={handleDateChange}
          />
        )}

        <InputField
          label="Email"
          placeholder="nama@email.com"
          value={email}
          onChangeText={setEmail}
          icon="mail-outline"
          keyboardType="email-address"
        />

        <InputField
          label="Nomor HP"
          placeholder="08xxxxxxxxxx"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          icon="call-outline"
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Alamat</Text>
        <View style={[styles.inputWrap, styles.textAreaWrap]}>
          <Ionicons name="location-outline" size={20} color="#64748B" />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Masukkan alamat lengkap"
            placeholderTextColor="#94A3B8"
            value={address}
            onChangeText={setAddress}
            multiline
            textAlignVertical="top"
          />
        </View>

        <Pressable
          style={[styles.primaryButton, loading && styles.disabledButton]}
          onPress={handleCreateAccount}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? 'Membuat Akun & DID...' : 'Buat Akun'}
          </Text>
          <Ionicons name="arrow-forward-outline" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.noteCard}>
        <Ionicons name="information-circle-outline" size={22} color="#F97316" />
        <Text style={styles.noteText}>
          DID akan dibuat otomatis dan bersifat permanen. Setelah dibuat, DID
          tidak dapat dihapus atau diganti melalui aplikasi.
        </Text>
      </View>
    </ScrollView>
  );
}

function InputField({
  label,
  placeholder,
  value,
  onChangeText,
  icon,
  keyboardType,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <Ionicons name={icon} size={20} color="#64748B" />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
        />
      </View>
    </View>
  );
}

function formatDate(date: Date) {
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhoneNumber(phone: string) {
  return /^08[0-9]{8,13}$/.test(phone);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingTop: 54,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 22,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 28,
    color: '#111827',
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  label: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '900',
    marginBottom: 8,
  },
  inputWrap: {
    minHeight: 52,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
  },
  dateInput: {
    minHeight: 52,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  dateText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
  },
  placeholderText: {
    color: '#94A3B8',
  },
  textAreaWrap: {
    minHeight: 100,
    alignItems: 'flex-start',
    paddingTop: 14,
    marginBottom: 16,
  },
  textArea: {
    minHeight: 76,
    paddingTop: 0,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 18,
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  disabledButton: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#FFFFFF',
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