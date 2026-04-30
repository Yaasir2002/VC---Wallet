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

import { CredentialDocument, ModularCredential } from '../../../src/types/vc';
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
      Alert.alert('Error', 'Gagal mengambil detail dokumen credential');
    }
  }

  if (!document) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="hourglass-outline" size={36} color="#2563EB" />
        <Text style={styles.loadingText}>Memuat detail credential...</Text>
      </View>
    );
  }

  const documentStatus = getDocumentStatus(document);

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
          <Text style={styles.heroLabel}>Detail Kredensial</Text>
          <Text style={styles.heroTitle}>{document.documentName}</Text>
          <Text style={styles.heroSubtitle}>
            Lihat atribut spesifik, status verifikasi, issuer, dan masa berlaku
            kredensial.
          </Text>
        </View>

        <View style={styles.heroIcon}>
          <Ionicons
            name={getDocumentIcon(document.documentType)}
            size={36}
            color="#2563EB"
          />
        </View>
      </LinearGradient>

      <View
        style={[
          styles.statusCard,
          documentStatus.status === 'VALID'
            ? styles.validStatusCard
            : styles.expiredStatusCard,
        ]}
      >
        <View
          style={[
            styles.statusIcon,
            documentStatus.status === 'VALID'
              ? styles.validStatusIcon
              : styles.expiredStatusIcon,
          ]}
        >
          <Ionicons
            name={
              documentStatus.status === 'VALID'
                ? 'checkmark-circle-outline'
                : 'alert-circle-outline'
            }
            size={28}
            color={documentStatus.status === 'VALID' ? '#16A34A' : '#DC2626'}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.statusTitle,
              documentStatus.status === 'VALID'
                ? styles.validText
                : styles.expiredText,
            ]}
          >
            {documentStatus.label}
          </Text>
          <Text style={styles.statusSubtitle}>
            {documentStatus.description}
          </Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconBlue}>
            <Ionicons name="document-text-outline" size={22} color="#2563EB" />
          </View>
          <Text style={styles.sectionTitle}>Informasi Kredensial</Text>
        </View>

        <InfoItem label="Document ID" value={document.documentId} />
        <InfoItem label="Document Type" value={document.documentType} />
        <InfoItem label="Document Name" value={document.documentName} />
        <InfoItem
          label="Jumlah Atribut"
          value={`${document.credentials.length} atribut`}
        />
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconOrange}>
            <Ionicons name="list-outline" size={22} color="#F97316" />
          </View>
          <Text style={styles.sectionTitle}>Atribut di Dalam Kredensial</Text>
        </View>

        {document.credentials.map((vc) => (
          <AttributeItem key={vc.id} credential={vc} />
        ))}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconBlue}>
            <Ionicons name="shield-checkmark-outline" size={22} color="#2563EB" />
          </View>
          <Text style={styles.sectionTitle}>Status Verifikasi</Text>
        </View>

        <VerificationCheck
          label="Struktur Credential"
          valid={document.credentials.length > 0}
        />
        <VerificationCheck
          label="Issuer DID"
          valid={document.credentials.every((vc) => !!vc.issuer)}
        />
        <VerificationCheck
          label="Subject DID"
          valid={document.credentials.every((vc) => !!vc.credentialSubject?.id)}
        />
        <VerificationCheck
          label="JWT / Proof"
          valid={document.credentials.every((vc) => !!vc.jwt || !!vc.proof?.jwt)}
        />
      </View>

      <AnimatedButton
        style={styles.prepareButton}
        onPress={() =>
          router.push({
            pathname: '/credential/present',
            params: {
              documentId: document.documentId,
              requester: 'Cascadia Regional Security',
            },
          })
        }
      >
        <Ionicons name="qr-code-outline" size={22} color="#FFFFFF" />
        <Text style={styles.prepareButtonText}>Prepare Presentation</Text>
      </AnimatedButton>

      <View style={styles.noteCard}>
        <Ionicons name="information-circle-outline" size={22} color="#F97316" />
        <Text style={styles.noteText}>
          Tombol Prepare Presentation akan membuka halaman selective disclosure.
          Kamu dapat memilih atribut mana saja yang ingin dibagikan kepada pihak
          verifikator.
        </Text>
      </View>
    </ScrollView>
  );
}

function AttributeItem({ credential }: { credential: ModularCredential }) {
  const status = getCredentialStatus(credential);

  return (
    <View style={styles.attributeItem}>
      <View style={styles.attributeIcon}>
        <Ionicons name="document-text-outline" size={20} color="#2563EB" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.attributeName}>
          {credential.credentialSubject.attributeName}
        </Text>

        <Text style={styles.attributeValue}>
          {credential.credentialSubject.attributeValue || '-'}
        </Text>

        <Text style={styles.attributeMeta}>
          Type: {credential.credentialSubject.attributeType}
        </Text>

        <Text style={styles.attributeMeta}>
          Issuer: {shorten(credential.issuer)}
        </Text>
      </View>

      <View
        style={
          status.status === 'VALID'
            ? styles.attributeValidBadge
            : styles.attributeExpiredBadge
        }
      >
        <Text
          style={
            status.status === 'VALID'
              ? styles.attributeValidBadgeText
              : styles.attributeExpiredBadgeText
          }
        >
          {status.label}
        </Text>
      </View>
    </View>
  );
}

function VerificationCheck({
  label,
  valid,
}: {
  label: string;
  valid: boolean;
}) {
  return (
    <View style={styles.checkRow}>
      <Ionicons
        name={valid ? 'checkmark-circle-outline' : 'close-circle-outline'}
        size={22}
        color={valid ? '#16A34A' : '#DC2626'}
      />
      <Text style={styles.checkText}>{label}</Text>
      <Text style={valid ? styles.checkValidText : styles.checkInvalidText}>
        {valid ? 'Valid' : 'Invalid'}
      </Text>
    </View>
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

function getCredentialStatus(credential: ModularCredential) {
  if (!credential.expirationDate) {
    return {
      status: 'VALID',
      label: 'VALID',
    };
  }

  const isExpired = new Date(credential.expirationDate) < new Date();

  return {
    status: isExpired ? 'EXPIRED' : 'VALID',
    label: isExpired ? 'EXPIRED' : 'VALID',
  };
}

function getDocumentStatus(document: CredentialDocument) {
  const hasExpired = document.credentials.some((vc) => {
    if (!vc.expirationDate) return false;
    return new Date(vc.expirationDate) < new Date();
  });

  if (hasExpired) {
    return {
      status: 'EXPIRED',
      label: 'EXPIRED',
      description:
        'Salah satu atribut credential sudah melewati masa berlaku.',
    };
  }

  return {
    status: 'VALID',
    label: 'VALID CREDENTIAL',
    description:
      'Seluruh atribut credential masih dapat digunakan untuk presentasi.',
  };
}

function getDocumentIcon(documentType: string) {
  if (documentType === 'KTP') return 'id-card-outline';
  if (documentType === 'SIM') return 'car-outline';
  if (documentType === 'IJAZAH') return 'school-outline';

  return 'document-text-outline';
}

function shorten(value?: string) {
  if (!value) return '-';
  if (value.length <= 22) return value;
  return `${value.slice(0, 14)}...${value.slice(-6)}`;
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
  statusCard: {
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  validStatusCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  expiredStatusCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validStatusIcon: {
    backgroundColor: '#DCFCE7',
  },
  expiredStatusIcon: {
    backgroundColor: '#FEE2E2',
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  validText: {
    color: '#166534',
  },
  expiredText: {
    color: '#991B1B',
  },
  statusSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 3,
    lineHeight: 19,
    fontWeight: '700',
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
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  sectionIconBlue: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconOrange: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '900',
    flex: 1,
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
  attributeValidBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  attributeExpiredBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  attributeValidBadgeText: {
    color: '#166534',
    fontSize: 10,
    fontWeight: '900',
  },
  attributeExpiredBadgeText: {
    color: '#991B1B',
    fontSize: 10,
    fontWeight: '900',
  },
  checkRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  checkText: {
    flex: 1,
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
  },
  checkValidText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '900',
  },
  checkInvalidText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '900',
  },
  prepareButton: {
    backgroundColor: '#F97316',
    marginTop: 18,
    paddingVertical: 15,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  prepareButtonText: {
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