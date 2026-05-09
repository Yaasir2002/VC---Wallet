import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Modal,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';

import {
  getUserProfile,
  saveUserProfile,
  UserProfile,
} from '../../src/Storage/profileStorage';
import { getDID } from '../../src/Storage/didStorage';
import { DIDData } from '../../src/types/did';
import { lockSession, refreshSession } from '../../src/Storage/authStorage';
import { safeLogger } from '../../src/utils/safeLogger';
import {
  isValidEmail,
  isValidIndonesianPhone as isValidPhoneNumber,
} from '../../src/utils/validators';
import {
  markSystemUIOpen,
  markSystemUIClosed,
} from '../../src/utils/systemUIGuard';

import AppToast from '../../components/ui/AppToast';

export default function SettingsScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [didData, setDidData] = useState<DIDData | null>(null);
  const [editVisible, setEditVisible] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [profileImageUri, setProfileImageUri] = useState<string | undefined>();

  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'info',
  });

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  async function loadSettings() {
    try {
      const userProfile = await getUserProfile();
      const did = await getDID();

      setProfile(userProfile);
      setDidData(did);
    } catch (error) {
      safeLogger.error('Failed to load settings');

      setToast({
        visible: true,
        message: 'Gagal memuat pengaturan',
        type: 'error',
      });
    }
  }

  function openEditProfile() {
    if (!profile) {
      Alert.alert('Profil belum tersedia', 'Silakan buat akun terlebih dahulu.');
      return;
    }

    setFullName(profile.fullName);
    setEmail(profile.email);
    setPhoneNumber(profile.phoneNumber);
    setAddress(profile.address);
    setProfileImageUri(profile.profileImageUri);
    setEditVisible(true);
  }

  async function handlePickProfileImage() {
    try {
      // Mark system UI open BEFORE requesting permission (permission dialog
      // also causes app to go 'background' on Android)
      markSystemUIOpen();

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Izin Dibutuhkan',
          'Aplikasi membutuhkan izin galeri untuk memilih foto profil.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets.length > 0) {
        setProfileImageUri(result.assets[0].uri);
      }
    } catch (error) {
      safeLogger.error('Failed to pick profile image');

      setToast({
        visible: true,
        message: 'Gagal memilih foto profil',
        type: 'error',
      });
    } finally {
      // Always release the guard and refresh session after gallery closes
      markSystemUIClosed();
      await refreshSession();
    }
  }

  async function handleSaveProfile() {
    if (!profile) return;

    if (!fullName.trim()) {
      Alert.alert('Validasi', 'Nama lengkap wajib diisi.');
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
      const updatedProfile: UserProfile = {
        ...profile,
        fullName: fullName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
        address: address.trim(),
        profileImageUri,
      };

      await saveUserProfile(updatedProfile);
      await refreshSession(); // reset session timeout on user activity
      setProfile(updatedProfile);
      setEditVisible(false);

      setToast({
        visible: true,
        message: 'Profil berhasil diperbarui',
        type: 'success',
      });
    } catch (error) {
      safeLogger.error('Failed to save profile');

      setToast({
        visible: true,
        message: 'Gagal memperbarui profil',
        type: 'error',
      });
    }
  }

  async function handleCopy(text?: string, label = 'Data') {
    if (!text) {
      setToast({
        visible: true,
        message: `${label} belum tersedia`,
        type: 'error',
      });
      return;
    }

    await Clipboard.setStringAsync(text);

    setToast({
      visible: true,
      message: `${label} berhasil disalin`,
      type: 'success',
    });
  }

  async function handleLockWallet() {
    await lockSession();
    router.replace('/auth/unlock');
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>
              Kelola profil, identitas digital, dan keamanan wallet.
            </Text>
          </View>

          <View style={styles.headerIcon}>
            <Ionicons name="settings-outline" size={30} color="#2563EB" />
          </View>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatar}>
              {profile?.profileImageUri ? (
                <Image
                  source={{ uri: profile.profileImageUri }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarText}>
                  {getInitial(profile?.fullName)}
                </Text>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>
                {profile?.fullName ?? 'Pengguna Wallet'}
              </Text>
              <Text style={styles.profileEmail}>
                {profile?.email ?? 'Email belum tersedia'}
              </Text>
            </View>

            <Pressable style={styles.editButton} onPress={openEditProfile}>
              <Ionicons name="create-outline" size={18} color="#2563EB" />
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
          </View>

          <View style={styles.profileDivider} />

          <InfoRow
            icon="calendar-outline"
            label="Tanggal Lahir"
            value={formatBirthDate(profile?.birthDate)}
          />

          <InfoRow
            icon="call-outline"
            label="Nomor HP"
            value={profile?.phoneNumber ?? '-'}
          />

          <InfoRow
            icon="location-outline"
            label="Alamat"
            value={profile?.address ?? '-'}
            multiline
          />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>Permanent DID</Text>
              <Text style={styles.cardSubtitle}>
                DID dibuat otomatis saat akun dibuat.
              </Text>
            </View>

            <View style={styles.permanentBadge}>
              <Text style={styles.permanentBadgeText}>LOCKED</Text>
            </View>
          </View>

          <View style={styles.didBox}>
            <Text style={styles.didLabel}>DID Address</Text>
            <Text style={styles.didText} numberOfLines={4}>
              {didData?.did ?? 'DID belum tersedia'}
            </Text>
          </View>

          <Pressable
            style={styles.copyButton}
            onPress={() => handleCopy(didData?.did, 'DID Address')}
          >
            <Ionicons name="copy-outline" size={17} color="#2563EB" />
            <Text style={styles.copyButtonText}>Copy DID Address</Text>
          </Pressable>

          <View style={styles.noticeBox}>
            <Ionicons name="lock-closed-outline" size={20} color="#F97316" />
            <Text style={styles.noticeText}>
              DID bersifat permanen dan tidak dapat dihapus atau diganti melalui
              aplikasi.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Security</Text>
          <Text style={styles.cardSubtitle}>
            Pengaturan keamanan lokal untuk menjaga akses wallet.
          </Text>

          <SettingItem
            icon="keypad-outline"
            title="PIN Login"
            description="Wallet diamankan menggunakan PIN lokal."
            status="Active"
          />

          <SettingItem
            icon="finger-print-outline"
            title="Biometric Authentication"
            description="Fitur biometrik dapat ditambahkan untuk login cepat."
            status="Soon"
          />

          <SettingItem
            icon="shield-checkmark-outline"
            title="Secure Storage"
            description="Profil, DID, dan session disimpan secara lokal."
            status="Active"
          />

          <Pressable style={styles.lockButton} onPress={handleLockWallet}>
            <Ionicons name="lock-closed-outline" size={18} color="#FFFFFF" />
            <Text style={styles.lockButtonText}>Lock Wallet</Text>
          </Pressable>
        </View>

        <View style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={22} color="#2563EB" />
          <Text style={styles.noteText}>
            Perubahan profil hanya mengubah data pengguna lokal. DID tetap sama
            dan tidak dibuat ulang.
          </Text>
        </View>
      </ScrollView>

      <Modal visible={editVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Ubah Profil</Text>

                <Pressable onPress={() => setEditVisible(false)}>
                  <Ionicons name="close-outline" size={26} color="#111827" />
                </Pressable>
              </View>

              <View style={styles.editPhotoSection}>
                <View style={styles.editAvatar}>
                  {profileImageUri ? (
                    <Image
                      source={{ uri: profileImageUri }}
                      style={styles.editAvatarImage}
                    />
                  ) : (
                    <Text style={styles.editAvatarText}>
                      {getInitial(fullName)}
                    </Text>
                  )}
                </View>

                <Pressable
                  style={styles.changePhotoButton}
                  onPress={handlePickProfileImage}
                >
                  <Ionicons name="camera-outline" size={18} color="#2563EB" />
                  <Text style={styles.changePhotoText}>Ubah Foto Profil</Text>
                </Pressable>
              </View>

              <ProfileInput
                label="Nama Lengkap"
                icon="person-outline"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Masukkan nama lengkap"
              />

              <ProfileInput
                label="Email"
                icon="mail-outline"
                value={email}
                onChangeText={setEmail}
                placeholder="Masukkan email"
                keyboardType="email-address"
              />

              <ProfileInput
                label="Nomor HP"
                icon="call-outline"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="Masukkan nomor HP"
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Alamat</Text>
              <View style={[styles.inputWrap, styles.textAreaWrap]}>
                <Ionicons name="location-outline" size={20} color="#64748B" />
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Masukkan alamat"
                  placeholderTextColor="#94A3B8"
                  value={address}
                  onChangeText={setAddress}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <Pressable style={styles.saveButton} onPress={handleSaveProfile}>
                <Text style={styles.saveButtonText}>Simpan Perubahan</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <AppToast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  multiline,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color="#2563EB" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text
          style={[styles.infoValue, multiline && styles.multilineValue]}
          numberOfLines={multiline ? 3 : 1}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function SettingItem({
  icon,
  title,
  description,
  status,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  status: string;
}) {
  const isActive = status === 'Active';

  return (
    <View style={styles.settingItem}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={20} color="#2563EB" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>

      <View
        style={[
          styles.statusBadge,
          isActive ? styles.activeStatus : styles.soonStatus,
        ]}
      >
        <Text
          style={[
            styles.statusText,
            isActive ? styles.activeStatusText : styles.soonStatusText,
          ]}
        >
          {status}
        </Text>
      </View>
    </View>
  );
}

function ProfileInput({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
}) {
  return (
    <View style={{ marginBottom: 13 }}>
      <Text style={styles.inputLabel}>{label}</Text>
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

function getInitial(name?: string) {
  if (!name) return 'U';

  const names = name.trim().split(' ').filter(Boolean);

  if (names.length === 1) {
    return names[0].charAt(0).toUpperCase();
  }

  return `${names[0].charAt(0)}${names[1].charAt(0)}`.toUpperCase();
}

function formatBirthDate(date?: string) {
  if (!date) return '-';

  try {
    return new Date(date).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return date;
  }
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingBottom: 42,
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 6,
    maxWidth: 230,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 62,
    height: 62,
    borderRadius: 31,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
  },
  profileName: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '900',
  },
  profileEmail: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
    marginTop: 3,
  },
  editButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 13,
    paddingVertical: 9,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  editButtonText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '900',
  },
  profileDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 18,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '800',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '800',
    marginTop: 3,
  },
  multilineValue: {
    lineHeight: 19,
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: 19,
    color: '#111827',
    fontWeight: '900',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 4,
  },
  permanentBadge: {
    backgroundColor: '#DCFCE7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  permanentBadgeText: {
    color: '#166534',
    fontSize: 10,
    fontWeight: '900',
  },
  didBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    padding: 14,
    marginTop: 16,
  },
  didLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '900',
    marginBottom: 6,
  },
  didText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  copyButton: {
    backgroundColor: '#EFF6FF',
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  copyButtonText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '900',
  },
  noticeBox: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  noticeText: {
    flex: 1,
    color: '#9A3412',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  settingIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTitle: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '900',
  },
  settingDescription: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 3,
  },
  statusBadge: {
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  activeStatus: {
    backgroundColor: '#DCFCE7',
  },
  soonStatus: {
    backgroundColor: '#F1F5F9',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
  },
  activeStatusText: {
    color: '#166534',
  },
  soonStatusText: {
    color: '#64748B',
  },
  lockButton: {
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  lockButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },
  noteCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 20,
    padding: 16,
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  noteText: {
    flex: 1,
    color: '#1E40AF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#111827',
  },
  editPhotoSection: {
    alignItems: 'center',
    marginBottom: 18,
  },
  editAvatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 12,
  },
  editAvatarImage: {
    width: 92,
    height: 92,
    borderRadius: 46,
  },
  editAvatarText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
  },
  changePhotoButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  changePhotoText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '900',
  },
  inputLabel: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '900',
    marginBottom: 7,
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
  textAreaWrap: {
    minHeight: 96,
    alignItems: 'flex-start',
    paddingTop: 14,
    marginBottom: 16,
  },
  textArea: {
    minHeight: 72,
    paddingTop: 0,
  },
  saveButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});