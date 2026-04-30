import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { CredentialDocument } from '../../../src/types/vc';
import { getCredentialDocumentById } from '../../../src/Services/documentCredentialService';
import AnimatedButton from '../../../components/ui/AnimatedButton';

export default function CredentialDocumentDetailScreen() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const router = useRouter();

  const [document, setDocument] = useState<CredentialDocument | null>(null);

  useEffect(() => {
    loadDocument();
  }, [documentId]);

  async function loadDocument() {
    try {
      if (!documentId) return;

      const data = await getCredentialDocumentById(documentId);

      if (!data) {
        Alert.alert('Tidak ditemukan', 'Dokumen credential tidak ditemukan');
        router.back();
        return;
      }

      setDocument(data);
    } catch (error) {
      console.log('LOAD DOCUMENT DETAIL ERROR:', error);
      Alert.alert('Error', 'Gagal mengambil detail dokumen');
    }
  }

  if (!document) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="hourglass-outline" size={36} color="#2563EB" />
        <Text style={styles.loadingText}>Memuat dokumen...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back-outline" size={20} color="#111827" />
        <Text style={styles.backText}>Kembali</Text>
      </Pressable>

      <LinearGradient
        colors={['#2563EB', '#1D4ED8', '#F97316']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View>
          <Text style={styles.heroLabel}>{document.documentType}</Text>
          <Text style={styles.heroTitle}>{document.documentName}</Text>
          <Text style={styles.heroSubtitle}>
            Pilih presentasi untuk menentukan atribut mana saja yang ingin
            dibagikan.
          </Text>
        </View>

        <View style={styles.heroIcon}>
          <Ionicons name="id-card-outline" size={36} color="#2563EB" />
        </View>
      </LinearGradient>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Informasi Dokumen</Text>
          <Text style={styles.countText}>
            {document.credentials.length} atribut
          </Text>
        </View>

        <InfoItem label="Document ID" value={document.documentId} />
        <InfoItem label="Document Type" value={document.documentType} />
        <InfoItem label="Document Name" value={document.documentName} />
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Atribut Credential</Text>

        {document.credentials.map((vc) => (
          <View key={vc.id} style={styles.attributeItem}>
            <View style={styles.attributeIcon}>
              <Ionicons name="document-text-outline" size={20} color="#2563EB" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.attributeName}>
                {vc.credentialSubject.attributeName}
              </Text>
              <Text style={styles.attributeValue}>
                {vc.credentialSubject.attributeValue}
              </Text>
              <Text style={styles.attributeMeta}>
                Type: {vc.credentialSubject.attributeType}
              </Text>
            </View>

            <View style={vc.jwt ? styles.jwtBadge : styles.noJwtBadge}>
              <Text style={vc.jwt ? styles.jwtBadgeText : styles.noJwtBadgeText}>
                {vc.jwt ? 'JWT' : 'NO JWT'}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <AnimatedButton
        style={styles.presentButton}
        onPress={() =>
          router.push({
            pathname: '/credential/present',
            params: { documentId: document.documentId },
          })
        }
      >
        <Ionicons name="qr-code-outline" size={22} color="#FFFFFF" />
        <Text style={styles.presentButtonText}>Present QR VC</Text>
      </AnimatedButton>

      <View style={styles.noteCard}>
        <Ionicons name="information-circle-outline" size={22} color="#F97316" />
        <Text style={styles.noteText}>
          Saat presentasi, kamu dapat memilih atribut mana saja yang ingin
          ditampilkan ke verifier.
        </Text>
      </View>
    </ScrollView>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '700',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  backText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
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
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '900',
    marginTop: 2,
    maxWidth: 230,
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
  sectionCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '900',
  },
  countText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '900',
  },
  infoItem: {
    marginTop: 12,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '900',
  },
  value: {
    fontSize: 14,
    color: '#111827',
    marginTop: 5,
    lineHeight: 20,
    fontWeight: '600',
  },
  attributeItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  attributeIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attributeName: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '900',
  },
  attributeValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '700',
    marginTop: 3,
  },
  attributeMeta: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '700',
    marginTop: 4,
  },
  jwtBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  noJwtBadge: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  jwtBadgeText: {
    color: '#166534',
    fontSize: 10,
    fontWeight: '900',
  },
  noJwtBadgeText: {
    color: '#C2410C',
    fontSize: 10,
    fontWeight: '900',
  },
  presentButton: {
    backgroundColor: '#F97316',
    marginTop: 18,
    paddingVertical: 15,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  presentButtonText: {
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