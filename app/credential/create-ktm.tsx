import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import AppToast from '../../components/ui/AppToast';
import AnimatedButton from '../../components/ui/AnimatedButton';
import { createKtmCredential } from '../../src/Services/documentCredentialService';

export default function CreateKtmScreen() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [universityName, setUniversityName] = useState('');
  const [faculty, setFaculty] = useState('');
  const [studyProgram, setStudyProgram] = useState('');
  const [degree, setDegree] = useState('');
  const [enrollmentYear, setEnrollmentYear] = useState('');
  const [studentStatus, setStudentStatus] = useState('');
  const [campusEmail, setCampusEmail] = useState('');
  const [validUntil, setValidUntil] = useState('');

  const [loading, setLoading] = useState(false);

  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'info',
  });

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

      await createKtmCredential({
        fullName: fullName.trim(),
        studentId: studentId.trim(),
        universityName: universityName.trim(),
        faculty: faculty.trim(),
        studyProgram: studyProgram.trim(),
        degree: degree.trim(),
        enrollmentYear: enrollmentYear.trim(),
        studentStatus: studentStatus.trim(),
        campusEmail: campusEmail.trim() || undefined,
        validUntil: validUntil.trim() || undefined,
      });

      setToast({
        visible: true,
        message: 'KTM Digital berhasil dibuat.',
        type: 'success',
      });

      setTimeout(() => {
        router.replace('/(tabs)/wallet');
      }, 700);
    } catch (error) {
      console.log('CREATE KTM CREDENTIAL ERROR:', error);

      setToast({
        visible: true,
        message: 'Gagal membuat KTM Digital. Pastikan DID sudah dibuat.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  function validateForm() {
    if (!fullName.trim()) return 'Nama lengkap wajib diisi.';
    if (!studentId.trim()) return 'NIM wajib diisi.';
    if (!/^[a-zA-Z0-9]+$/.test(studentId.trim())) {
      return 'NIM hanya boleh berisi huruf dan angka.';
    }
    if (!universityName.trim()) return 'Nama kampus wajib diisi.';
    if (!faculty.trim()) return 'Fakultas wajib diisi.';
    if (!studyProgram.trim()) return 'Program studi wajib diisi.';
    if (!degree.trim()) return 'Jenjang pendidikan wajib dipilih.';
    if (!enrollmentYear.trim()) return 'Tahun masuk wajib diisi.';
    if (!/^[0-9]{4}$/.test(enrollmentYear.trim())) {
      return 'Tahun masuk harus berisi 4 digit angka.';
    }
    if (!studentStatus.trim()) return 'Status mahasiswa wajib dipilih.';
    if (campusEmail.trim() && !isValidEmail(campusEmail.trim())) {
      return 'Format email kampus tidak valid.';
    }

    return '';
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
            <Ionicons name="school-outline" size={38} color="#2563EB" />
          </View>

          <Text style={styles.heroTitle}>KTM Digital</Text>

          <Text style={styles.heroSubtitle}>
            Lengkapi data akademik untuk membuat credential identitas mahasiswa.
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
            label="NIM"
            placeholder="Masukkan NIM"
            value={studentId}
            onChangeText={(value) =>
              setStudentId(value.replace(/[^a-zA-Z0-9]/g, ''))
            }
            icon="card-outline"
            autoCapitalize="characters"
          />

          <InputField
            label="Nama Kampus"
            placeholder="Contoh: STT Terpadu Nurul Fikri"
            value={universityName}
            onChangeText={setUniversityName}
            icon="business-outline"
          />

          <InputField
            label="Fakultas"
            placeholder="Contoh: Fakultas Ilmu Komputer"
            value={faculty}
            onChangeText={setFaculty}
            icon="library-outline"
          />

          <InputField
            label="Program Studi"
            placeholder="Contoh: Teknik Informatika"
            value={studyProgram}
            onChangeText={setStudyProgram}
            icon="code-slash-outline"
          />

          <OptionGroup
            label="Jenjang Pendidikan"
            options={['D3', 'S1', 'S2', 'S3']}
            selectedValue={degree}
            onSelect={setDegree}
          />

          <InputField
            label="Tahun Masuk"
            placeholder="Contoh: 2022"
            value={enrollmentYear}
            onChangeText={(value) =>
              setEnrollmentYear(value.replace(/[^0-9]/g, ''))
            }
            icon="calendar-outline"
            keyboardType="numeric"
            maxLength={4}
          />

          <OptionGroup
            label="Status Mahasiswa"
            options={['Aktif', 'Cuti', 'Lulus', 'Nonaktif']}
            selectedValue={studentStatus}
            onSelect={setStudentStatus}
          />

          <InputField
            label="Email Kampus"
            placeholder="nama@student.ac.id"
            value={campusEmail}
            onChangeText={setCampusEmail}
            icon="mail-outline"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <InputField
            label="Berlaku Hingga"
            placeholder="Contoh: 31 Desember 2026"
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
              {loading ? 'Menyimpan...' : 'Simpan KTM Digital'}
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
  autoCapitalize,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
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
          autoCapitalize={autoCapitalize ?? 'words'}
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

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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