import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

export default function CreateCredentialScreen() {
  const router = useRouter();

  return (
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
          <Ionicons name="add-circle-outline" size={38} color="#2563EB" />
        </View>

        <Text style={styles.heroTitle}>Tambah Credential</Text>

        <Text style={styles.heroSubtitle}>
          Pilih jenis dokumen yang ingin dibuat sebagai credential digital.
        </Text>
      </LinearGradient>

      <View style={styles.optionSection}>
        <CredentialOptionCard
          icon="id-card-outline"
          title="KTP Digital"
          description="Credential identitas kependudukan seperti nama, NIK, tanggal lahir, dan alamat."
          badge="KTP"
          onPress={() => router.push('/credential/create-ktp')}
        />
      </View>

      <View style={styles.noteCard}>
        <Ionicons name="information-circle-outline" size={22} color="#2563EB" />
        <Text style={styles.noteText}>
          Fitur tambah KTM Digital manual telah dinonaktifkan. Credential
          akademik sebaiknya diterima dari issuer resmi melalui scan QR atau
          credential offer.
        </Text>
      </View>
    </ScrollView>
  );
}

function CredentialOptionCard({
  icon,
  title,
  description,
  badge,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  badge: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.optionCard,
        pressed && styles.optionCardPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.optionIcon}>
        <Ionicons name={icon} size={32} color="#2563EB" />
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.optionTitleRow}>
          <Text style={styles.optionTitle}>{title}</Text>

          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        </View>

        <Text style={styles.optionDescription}>{description}</Text>
      </View>

      <Ionicons name="chevron-forward-outline" size={22} color="#6B7280" />
    </Pressable>
  );
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
    maxWidth: 310,
  },
  optionSection: {
    marginTop: 18,
    gap: 14,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  optionCardPressed: {
    borderColor: '#2563EB',
    backgroundColor: '#F8FAFC',
    transform: [{ scale: 0.99 }],
  },
  optionIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111827',
  },
  optionDescription: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 6,
  },
  badge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: {
    color: '#2563EB',
    fontSize: 10,
    fontWeight: '900',
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
});