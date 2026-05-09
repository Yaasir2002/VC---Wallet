import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

import AppToast from '../../components/ui/AppToast';
import AnimatedButton from '../../components/ui/AnimatedButton';
import { createKtpCredential } from '../../src/Services/documentCredentialService';
import { safeLogger } from '../../src/utils/safeLogger';

export default function CreateKtpScreen() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [nik, setNik] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [gender, setGender] = useState('');
  const [address, setAddress] = useState('');
  const [religion, setReligion] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [occupation, setOccupation] = useState('');
  const [citizenship, setCitizenship] = useState('WNI');
  const [validUntil, setValidUntil] = useState('Seumur Hidup');

  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'info',
  });

  const birthDateText = birthDate ? formatDate(birthDate) : '';

  async function handleSubmit() {
    const validationMessage = validateForm();

    if (validationMessage) {
      setToast({
        visible: true,
        message: validationMessage,
        type: 'error',
      });
      return;
    }

    try {
      setLoading(true);

      await createKtpCredential({
        fullName: fullName.trim(),
        nik: nik.trim(),
        birthPlace: birthPlace.trim(),
        birthDate: birthDateText,
        gender: gender.trim(),
        address: address.trim(),
        religion: religion.trim(),
        maritalStatus: maritalStatus.trim(),
        occupation: occupation.trim(),
        citizenship: citizenship.trim(),
        validUntil: validUntil.trim() || 'Seumur Hidup',
      });

      setToast({
        visible: true,
        message: 'KTP Digital berhasil dibuat.',
        type: 'success',
      });

      setTimeout(() => {
        router.replace('/(tabs)/wallet');
      }, 700);
    } catch (error) {
      safeLogger.error('Failed to create KTP credential');

      setToast({
        visible: true,
        message: 'Gagal membuat KTP Digital. Pastikan DID sudah dibuat.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  function validateForm() {
    if (!fullName.trim()) return 'Nama lengkap wajib diisi.';
    if (!nik.trim()) return 'NIK wajib diisi.';
    if (!/^[0-9]{16}$/.test(nik.trim())) {
      return 'NIK harus berisi 16 digit angka.';
    }
    if (!birthPlace.trim()) return 'Tempat lahir wajib diisi.';
    if (!birthDate) return 'Tanggal lahir wajib diisi.';
    if (!gender.trim()) return 'Jenis kelamin wajib dipilih.';
    if (!address.trim()) return 'Alamat wajib diisi.';
    if (!religion.trim()) return 'Agama wajib diisi.';
    if (!maritalStatus.trim()) return 'Status perkawinan wajib diisi.';
    if (!occupation.trim()) return 'Pekerjaan wajib diisi.';
    if (!citizenship.trim()) return 'Kewarganegaraan wajib diisi.';

    return '';
  }

  function handleBirthDateChange(_: unknown, selectedDate?: Date) {
    if (Platform.OS === 'android') {
      setShowBirthDatePicker(false);
    }

    if (selectedDate) {
      setBirthDate(selectedDate);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <LinearGradient
          colors={['#2563EB', '#1D4ED8', '#F97316']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back-outline" size={22} color="#FFFFFF" />
          </Pressable>

          <View style={styles.heroIcon}>
            <Ionicons name="id-card-outline" size={38} color="#2563EB" />
          </View>

          <Text style={styles.heroTitle}>KTP Digital</Text>

          <Text style={styles.heroSubtitle}>
            Lengkapi data identitas kependudukan untuk membuat credential KTP.
          </Text>
        </LinearGradient>

        <View style={styles.formCard}>
          <InputField
            label="Nama Lengkap"
            placeholder="Masukkan nama lengkap"
            value={fullName}
            onChangeText={setFullName}
            icon="person-outline"
          />

          <InputField
            label="NIK"
            placeholder="16 digit NIK"
            value={nik}
            onChangeText={(value) => setNik(value.replace(/[^0-9]/g, ''))}
            icon="card-outline"
            keyboardType="numeric"
            maxLength={16}
          />

          <InputField
            label="Tempat Lahir"
            placeholder="Contoh: Bogor"
            value={birthPlace}
            onChangeText={setBirthPlace}
            icon="location-outline"
          />

          <Text style={styles.label}>Tanggal Lahir</Text>
          <Pressable
            style={styles.dateInput}
            onPress={() => setShowBirthDatePicker(true)}
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

          {showBirthDatePicker && (
            <DateTimePicker
              value={birthDate ?? new Date(2000, 0, 1)}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              onChange={handleBirthDateChange}
            />
          )}

          <OptionGroup
            label="Jenis Kelamin"
            options={['Laki-laki', 'Perempuan']}
            selectedValue={gender}
            onSelect={setGender}
          />

          <Text style={styles.label}>Alamat</Text>
          <View style={[styles.inputWrap, styles.textAreaWrap]}>
            <Ionicons name="home-outline" size={20} color="#64748B" />
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

          <InputField
            label="Agama"
            placeholder="Contoh: Islam"
            value={religion}
            onChangeText={setReligion}
            icon="book-outline"
          />

          <OptionGroup
            label="Status Perkawinan"
            options={['Belum Kawin', 'Kawin', 'Cerai Hidup', 'Cerai Mati']}
            selectedValue={maritalStatus}
            onSelect={setMaritalStatus}
          />

          <InputField
            label="Pekerjaan"
            placeholder="Contoh: Mahasiswa"
            value={occupation}
            onChangeText={setOccupation}
            icon="briefcase-outline"
          />

          <InputField
            label="Kewarganegaraan"
            placeholder="Contoh: WNI"
            value={citizenship}
            onChangeText={setCitizenship}
            icon="flag-outline"
          />

          <InputField
            label="Berlaku Hingga"
            placeholder="Contoh: Seumur Hidup"
            value={validUntil}
            onChangeText={setValidUntil}
            icon="time-outline"
          />

          <AnimatedButton
            style={[styles.submitButton, loading && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Ionicons name="save-outline" size={20} color="#FFFFFF" />
            <Text style={styles.submitButtonText}>
              {loading ? 'Menyimpan...' : 'Simpan KTP Digital'}
            </Text>
          </AnimatedButton>
        </View>
      </ScrollView>

      <AppToast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />
    </View>
  );
}

function InputField({
  label,
  placeholder,
  value,
  onChangeText,
  icon,
  keyboardType,
  maxLength,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  maxLength?: number;
}) {
  return (
    <View style={styles.fieldGroup}>
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
          maxLength={maxLength}
          autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
        />
      </View>
    </View>
  );
}

function OptionGroup({
  label,
  options,
  selectedValue,
  onSelect,
}: {
  label: string;
  options: string[];
  selectedValue: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.optionWrap}>
        {options.map((option) => {
          const isActive = selectedValue === option;

          return (
            <Pressable
              key={option}
              style={[styles.optionChip, isActive && styles.optionChipActive]}
              onPress={() => onSelect(option)}
            >
              <Text
                style={[
                  styles.optionChipText,
                  isActive && styles.optionChipTextActive,
                ]}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  hero: {
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    marginBottom: 16,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
  },
  heroSubtitle: {
    color: '#DBEAFE',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 320,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 18,
  },
  fieldGroup: {
    marginBottom: 14,
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
    marginBottom: 14,
  },
  textArea: {
    minHeight: 76,
    paddingTop: 0,
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  optionChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  optionChipText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '800',
  },
  optionChipTextActive: {
    color: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: '#2563EB',
    marginTop: 8,
    borderRadius: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  disabledButton: {
    opacity: 0.65,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
});