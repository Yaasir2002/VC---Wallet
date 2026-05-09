import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Switch,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';

import { CredentialDocument } from '../../../src/types/vc';
import { getCredentialDocumentById } from '../../../src/Services/documentCredentialService';
import {
  SelectedAttributeMap,
  buildCredentialPresentationPayload,
  createDefaultSelectedAttributes,
  extractPresentationAttributes,
  stringifyPresentationPayload,
} from '../../../src/Services/credentialPresentationService';

export default function CredentialDocumentDetailScreen() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const router = useRouter();

  const [document, setDocument] = useState<CredentialDocument | null>(null);
  const [selectedAttributes, setSelectedAttributes] =
    useState<SelectedAttributeMap>({});
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrPayload, setQrPayload] = useState('');
  const [selectedAttributeNames, setSelectedAttributeNames] = useState<string[]>(
    []
  );

  useEffect(() => {
    loadDocument();
  }, [documentId]);

  async function loadDocument() {
    try {
      if (!documentId) {
        Alert.alert('Error', 'ID dokumen credential tidak valid');
        router.back();
        return;
      }

      const data = await getCredentialDocumentById(documentId);

      if (!data) {
        Alert.alert('Tidak ditemukan', 'Dokumen credential tidak ditemukan');
        router.back();
        return;
      }

      const attributes = extractPresentationAttributes(data);

      if (attributes.length === 0) {
        Alert.alert('Atribut kosong', 'Credential ini tidak memiliki atribut.');
      }

      setDocument(data);
      setSelectedAttributes(createDefaultSelectedAttributes(attributes));
    } catch {
      Alert.alert('Error', 'Gagal mengambil detail dokumen credential');
    }
  }

  const presentationAttributes = useMemo(() => {
    if (!document) return [];
    return extractPresentationAttributes(document);
  }, [document]);

  function handleToggleAttribute(attributeId: string) {
    setSelectedAttributes((current) => ({
      ...current,
      [attributeId]: !current[attributeId],
    }));
  }

  function handleGenerateQR() {
    if (!document) {
      Alert.alert('Error', 'Credential tidak ditemukan');
      return;
    }

    try {
      const payload = buildCredentialPresentationPayload(
        document,
        selectedAttributes
      );

      const payloadString = stringifyPresentationPayload(payload);

      setQrPayload(payloadString);
      setSelectedAttributeNames(payload.presentationMetadata.selectedAttributes);
      setShowQRModal(true);
    } catch (error) {
      Alert.alert(
        'Tidak Bisa Membuat QR',
        error instanceof Error
          ? error.message
          : 'Gagal membuat QR presentation'
      );
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
  const selectedCount = presentationAttributes.filter(
    (attribute) => selectedAttributes[attribute.id]
  ).length;

  return (
    <View style={{ flex: 1 }}>
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

        <View style={styles.presentationCard}>
          <View style={styles.presentationHeader}>
            <View style={styles.presentationIcon}>
              <Ionicons name="qr-code-outline" size={24} color="#2563EB" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.presentationTitle}>Presentasi QR</Text>
              <Text style={styles.presentationSubtitle}>
                {selectedCount} dari {presentationAttributes.length} atribut
                akan dibagikan.
              </Text>
            </View>
          </View>

          <Text style={styles.presentationNote}>
            Ini adalah UI-level attribute selection. Atribut yang dimatikan tidak
            dimasukkan ke payload QR, tetapi ini belum cryptographic selective
            disclosure.
          </Text>

          <Pressable
            style={styles.generateQRButton}
            onPress={handleGenerateQR}
          >
            <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" />
            <Text style={styles.generateQRButtonText}>Tampilkan QR</Text>
          </Pressable>
        </View>

        <View style={styles.tableCard}>
          <View style={styles.tableTitleRow}>
            <View>
              <Text style={styles.tableTitle}>Daftar Atribut</Text>
              <Text style={styles.tableSubtitle}>
                Aktifkan atribut yang ingin dibagikan.
              </Text>
            </View>
          </View>

          {presentationAttributes.map((attribute) => (
            <AttributeToggleRow
              key={attribute.id}
              attributeName={attribute.attributeName}
              attributeValue={attribute.attributeValue}
              enabled={!!selectedAttributes[attribute.id]}
              onToggle={() => handleToggleAttribute(attribute.id)}
            />
          ))}
        </View>
      </ScrollView>

      <Modal visible={showQRModal} transparent animationType="fade">
        <View style={styles.qrModalOverlay}>
          <View style={styles.qrModalBox}>
            <View style={styles.qrModalIcon}>
              <Ionicons name="qr-code-outline" size={34} color="#2563EB" />
            </View>

            <Text style={styles.qrModalTitle}>Credential Presentation</Text>

            <Text style={styles.qrModalSubtitle}>
              QR ini hanya berisi atribut yang kamu aktifkan.
            </Text>

            <View style={styles.qrContainer}>
              {qrPayload ? <QRCode value={qrPayload} size={220} /> : null}
            </View>

            <View style={styles.sharedAttributeBox}>
              <Text style={styles.sharedAttributeTitle}>
                Atribut yang dibagikan
              </Text>

              {selectedAttributeNames.map((name) => (
                <View key={name} style={styles.sharedAttributeChip}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={16}
                    color="#166534"
                  />
                  <Text style={styles.sharedAttributeText}>{name}</Text>
                </View>
              ))}
            </View>

            <View style={styles.qrWarningBox}>
              <Ionicons name="warning-outline" size={18} color="#C2410C" />
              <Text style={styles.qrWarningText}>
                Presentation ini belum ditandatangani secara cryptographic.
              </Text>
            </View>

            <Pressable
              style={styles.qrCloseButton}
              onPress={() => setShowQRModal(false)}
            >
              <Text style={styles.qrCloseButtonText}>Tutup</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function AttributeToggleRow({
  attributeName,
  attributeValue,
  enabled,
  onToggle,
}: {
  attributeName: string;
  attributeValue: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.attributeToggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.attributeName}>{attributeName}</Text>
        <Text style={styles.attributeValue}>{attributeValue || '-'}</Text>
      </View>

      <Switch
        value={enabled}
        onValueChange={onToggle}
        trackColor={{ false: '#E5E7EB', true: '#BFDBFE' }}
        thumbColor={enabled ? '#2563EB' : '#F9FAFB'}
      />
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
  presentationCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  presentationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  presentationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presentationTitle: {
    color: '#111827',
    fontWeight: '900',
    fontSize: 18,
  },
  presentationSubtitle: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 13,
    marginTop: 2,
  },
  presentationNote: {
    color: '#1E40AF',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 16,
    padding: 12,
    marginTop: 14,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  generateQRButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  generateQRButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tableTitleRow: {
    marginBottom: 14,
  },
  tableTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  tableSubtitle: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 13,
    marginTop: 4,
  },
  attributeToggleRow: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  attributeName: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '900',
  },
  attributeValue: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 4,
  },
  qrModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  qrModalBox: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 22,
    alignItems: 'center',
  },
  qrModalIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  qrModalTitle: {
    fontSize: 22,
    color: '#111827',
    fontWeight: '900',
    textAlign: 'center',
  },
  qrModalSubtitle: {
    color: '#6B7280',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  qrContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    padding: 14,
  },
  sharedAttributeBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    marginTop: 16,
    maxHeight: 150,
  },
  sharedAttributeTitle: {
    color: '#111827',
    fontWeight: '900',
    fontSize: 13,
    marginBottom: 8,
  },
  sharedAttributeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sharedAttributeText: {
    flex: 1,
    color: '#374151',
    fontSize: 12,
    fontWeight: '700',
  },
  qrWarningBox: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 16,
    padding: 12,
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  qrWarningText: {
    flex: 1,
    color: '#C2410C',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  qrCloseButton: {
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 18,
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
  },
  qrCloseButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },
});