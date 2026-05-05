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

import { CredentialDocument, ModularCredential } from '../../../src/types/vc';
import { getCredentialDocumentById } from '../../../src/Services/documentCredentialService';

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

  const mainCredential = getMainCredential(document);
  const status = getMainCredentialStatus(document);
  const isValid = status.status === 'VALID';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back-outline" size={20} color="#111827" />
        <Text style={styles.backText}>Kembali</Text>
      </Pressable>

      <View style={styles.titleSection}>
        <View style={styles.documentIcon}>
          <Ionicons
            name={getDocumentIcon(document.documentType)}
            size={38}
            color="#2563EB"
          />
        </View>

        <Text style={styles.documentTitle}>{getDetailTitle(document)}</Text>

        <Text style={styles.documentSubtitle}>Credential Parent</Text>

        <View
          style={[
            styles.statusBadge,
            isValid ? styles.statusValid : styles.statusExpired,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              isValid ? styles.statusTextValid : styles.statusTextExpired,
            ]}
          >
            {status.label}
          </Text>
        </View>

        <Text style={styles.issuerText} numberOfLines={2}>
          Issuer: {mainCredential?.issuer ?? 'Unknown Issuer'}
        </Text>
      </View>

      <View style={styles.tableCard}>
        <Text style={styles.tableTitle}>Daftar Atribut</Text>

        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.attributeColumn]}>
            Atribut
          </Text>
          <Text style={[styles.tableHeaderText, styles.valueColumn]}>
            Nilai
          </Text>
        </View>

        {document.credentials.map((credential) => (
          <AttributeRow key={credential.id} credential={credential} />
        ))}
      </View>
    </ScrollView>
  );
}

function AttributeRow({ credential }: { credential: ModularCredential }) {
  return (
    <View style={styles.tableRow}>
      <Text style={[styles.attributeName, styles.attributeColumn]}>
        {credential.credentialSubject.attributeName}
      </Text>

      <Text style={[styles.attributeValue, styles.valueColumn]}>
        {credential.credentialSubject.attributeValue || '-'}
      </Text>
    </View>
  );
}

function getDetailTitle(document: CredentialDocument) {
  if (document.documentType === 'KTP') return 'KTP (Kartu Tanda Penduduk)';
  if (document.documentType === 'KTM') return 'KTM (Kartu Tanda Mahasiswa)';
  if (document.documentType === 'SIM') return 'SIM (Surat Izin Mengemudi)';
  if (document.documentType === 'IJAZAH') return 'Ijazah Digital';

  return document.documentName || 'Credential Document';
}

function getDocumentIcon(documentType: string) {
  if (documentType === 'KTP') return 'id-card-outline';
  if (documentType === 'KTM') return 'school-outline';
  if (documentType === 'SIM') return 'car-outline';
  if (documentType === 'IJAZAH') return 'school-outline';

  return 'document-text-outline';
}

function getMainCredential(document: CredentialDocument) {
  const credentials = document.credentials ?? [];

  return (
    credentials.find(
      (vc) => vc.credentialSubject?.attributeType === 'legalName'
    ) ||
    credentials.find((vc) => vc.credentialSubject?.attributeType === 'nik') ||
    credentials.find(
      (vc) => vc.credentialSubject?.attributeType === 'studentId'
    ) ||
    credentials.find(
      (vc) => vc.credentialSubject?.attributeType === 'licenseNumber'
    ) ||
    credentials[0]
  );
}

function getMainCredentialStatus(document: CredentialDocument) {
  const mainCredential = getMainCredential(document);

  if (!mainCredential?.expirationDate) {
    return {
      status: 'VALID',
      label: 'VALID',
    };
  }

  const isExpired = new Date(mainCredential.expirationDate) < new Date();

  return {
    status: isExpired ? 'EXPIRED' : 'VALID',
    label: isExpired ? 'EXPIRED' : 'VALID',
  };
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
    marginBottom: 22,
  },
  backText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  titleSection: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  documentIcon: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  documentTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 32,
  },
  documentSubtitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  statusBadge: {
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusValid: {
    backgroundColor: '#DCFCE7',
    borderColor: '#166534',
  },
  statusExpired: {
    backgroundColor: '#FEF2F2',
    borderColor: '#991B1B',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  statusTextValid: {
    color: '#166534',
  },
  statusTextExpired: {
    color: '#991B1B',
  },
  issuerText: {
    marginTop: 14,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tableTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  tableHeaderText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#2563EB',
  },
  tableRow: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 13,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  attributeColumn: {
    flex: 0.45,
    paddingRight: 10,
  },
  valueColumn: {
    flex: 0.55,
  },
  attributeName: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '900',
  },
  attributeValue: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
    lineHeight: 18,
  },
});