import { useCallback, useEffect, useMemo, useState } from 'react';
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

import { ModularCredential } from '../../src/types/vc';
import { getVCById } from '../../src/Storage/vcStorage';
import {
  verifyVC,
  VCVerificationResult,
} from '../../src/Services/vcVerificationService';

import AnimatedButton from '../../components/ui/AnimatedButton';

type CredentialProof = {
  type?: string;
  proofPurpose?: string;
  verificationMethod?: string;
  jws?: string;
  jwt?: string;
  created?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getText(value: unknown, fallback = '-'): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'string') {
    return value.trim() || fallback;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return fallback;
}

function getProof(proof: unknown): CredentialProof | null {
  if (!isRecord(proof)) {
    return null;
  }

  return {
    type: getText(proof.type, ''),
    proofPurpose: getText(proof.proofPurpose, ''),
    verificationMethod: getText(proof.verificationMethod, ''),
    jws: getText(proof.jws, ''),
    jwt: getText(proof.jwt, ''),
    created: getText(proof.created, ''),
  };
}

function formatDate(value?: string): string {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function getCredentialDisplayTitle(credential: ModularCredential): string {
  if (credential.documentName) {
    return credential.documentName;
  }

  if (credential.documentType) {
    return `${credential.documentType} Credential`;
  }

  const specificType = credential.type.find(
    (item) => item !== 'VerifiableCredential'
  );

  return specificType || 'Verifiable Credential';
}

function getVerificationMessages(
  verification: VCVerificationResult | null
): string[] {
  if (!verification) {
    return [];
  }

  return [verification.reason].filter((message): message is string =>
    Boolean(message)
  );
}

export default function CredentialDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [credential, setCredential] = useState<ModularCredential | null>(null);
  const [verification, setVerification] =
    useState<VCVerificationResult | null>(null);

  const loadCredential = useCallback(async () => {
    try {
      if (!id) return;

      const data = await getVCById(id);

      if (!data) {
        Alert.alert('Tidak ditemukan', 'Credential tidak ditemukan');
        router.back();
        return;
      }

      setCredential(data);
      setVerification(await verifyVC(data));
    } catch {
      Alert.alert('Error', 'Gagal mengambil detail credential');
    }
  }, [id, router]);

  useEffect(() => {
    void loadCredential();
  }, [loadCredential]);

  const proof = useMemo(() => getProof(credential?.proof), [credential?.proof]);

  if (!credential) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="hourglass-outline" size={36} color="#2563EB" />
        <Text style={styles.loadingText}>Memuat credential...</Text>
      </View>
    );
  }

  const verificationMessages = getVerificationMessages(verification);
  const credentialTitle = getCredentialDisplayTitle(credential);

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
          <Text style={styles.heroLabel}>Credential Detail</Text>
          <Text style={styles.heroTitle}>{credentialTitle}</Text>
          <Text style={styles.heroSubtitle}>
            Review credential data, issuer, subject, and proof information.
          </Text>
        </View>

        <View style={styles.heroIcon}>
          <Ionicons name="shield-checkmark-outline" size={36} color="#2563EB" />
        </View>
      </LinearGradient>

      {verification && (
        <View
          style={[
            styles.verificationCard,
            verification.isValid ? styles.verifiedCard : styles.invalidCard,
          ]}
        >
          <View style={styles.verificationHeader}>
            <View
              style={[
                styles.verificationIcon,
                verification.isValid ? styles.verifiedIcon : styles.invalidIcon,
              ]}
            >
              <Ionicons
                name={
                  verification.isValid
                    ? 'checkmark-circle-outline'
                    : 'close-circle-outline'
                }
                size={28}
                color={verification.isValid ? '#16A34A' : '#DC2626'}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.verificationTitle,
                  verification.isValid
                    ? styles.verifiedText
                    : styles.invalidText,
                ]}
              >
                {verification.status}
              </Text>

              <Text style={styles.verificationSubtitle}>
                Basic credential verification result
              </Text>
            </View>
          </View>

          <View style={styles.checkGrid}>
            <View style={styles.checkItem}>
              <Text style={styles.checkEmoji}>
                {verification.checks.structure ? '✅' : '❌'}
              </Text>
              <Text style={styles.checkText}>Structure</Text>
            </View>

            <View style={styles.checkItem}>
              <Text style={styles.checkEmoji}>
                {verification.checks.trustedIssuer ? '✅' : '❌'}
              </Text>
              <Text style={styles.checkText}>Trusted Issuer</Text>
            </View>

            <View style={styles.checkItem}>
              <Text style={styles.checkEmoji}>
                {verification.checks.didResolution ? '✅' : '❌'}
              </Text>
              <Text style={styles.checkText}>DID Resolution</Text>
            </View>

            <View style={styles.checkItem}>
              <Text style={styles.checkEmoji}>
                {verification.checks.signature ? '✅' : '❌'}
              </Text>
              <Text style={styles.checkText}>Signature</Text>
            </View>
          </View>

          {verificationMessages.map((msg, index) => (
            <Text key={index} style={styles.verificationMessage}>
              • {msg}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconBlue}>
            <Ionicons name="document-text-outline" size={22} color="#2563EB" />
          </View>
          <Text style={styles.sectionTitle}>Credential Information</Text>
        </View>

        <InfoItem label="Credential ID" value={credential.id} />
        <InfoItem label="Document ID" value={credential.documentId} />
        <InfoItem label="Document Type" value={credential.documentType} />
        <InfoItem label="Document Name" value={credential.documentName} />
        <InfoItem label="Type" value={credential.type.join(', ')} />
        <InfoItem label="Issuer" value={credential.issuer} />
        <InfoItem
          label="Issuance Date"
          value={formatDate(credential.issuanceDate)}
        />
        <InfoItem
          label="Expiration Date"
          value={formatDate(credential.expirationDate)}
        />
        <InfoItem
          label="Verification Status"
          value={credential.verificationStatus ?? 'pending_verification'}
        />
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconOrange}>
            <Ionicons name="person-outline" size={22} color="#F97316" />
          </View>
          <Text style={styles.sectionTitle}>Credential Subject</Text>
        </View>

        <InfoItem label="Subject DID" value={credential.credentialSubject.id} />
        <InfoItem
          label="Attribute Type"
          value={credential.credentialSubject.attributeType}
        />
        <InfoItem
          label="Attribute Name"
          value={credential.credentialSubject.attributeName}
        />
        <InfoItem
          label="Attribute Value"
          value={credential.credentialSubject.attributeValue}
        />
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconBlue}>
            <Ionicons name="key-outline" size={22} color="#2563EB" />
          </View>
          <Text style={styles.sectionTitle}>Proof</Text>
        </View>

        {proof ? (
          <>
            <InfoItem label="Proof Type" value={proof.type || '-'} />
            <InfoItem label="Created" value={proof.created || '-'} />
            <InfoItem
              label="Proof Purpose"
              value={proof.proofPurpose || '-'}
            />
            <InfoItem
              label="Verification Method"
              value={proof.verificationMethod || '-'}
            />

            <Text style={styles.label}>Signature / JWT</Text>
            <Text style={styles.signatureText}>
              {proof.jws || proof.jwt || '-'}
            </Text>
          </>
        ) : (
          <View style={styles.emptyProof}>
            <Ionicons name="warning-outline" size={26} color="#F97316" />
            <Text style={styles.emptyProofText}>
              Credential belum memiliki proof.
            </Text>
          </View>
        )}
      </View>

      <AnimatedButton
        style={styles.presentButton}
        onPress={() =>
          router.push({
            pathname: '/credential/present',
            params: {
              documentId: credential.documentId,
              requester: 'Verifier',
            },
          })
        }
      >
        <Ionicons name="qr-code-outline" size={22} color="#FFFFFF" />
        <Text style={styles.presentButtonText}>Present Credential</Text>
      </AnimatedButton>

      <View style={styles.statusCard}>
        <Ionicons name="lock-closed-outline" size={22} color="#16A34A" />
        <Text style={styles.statusText}>Credential tersimpan lokal</Text>
      </View>
    </ScrollView>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || '-'}</Text>
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
    fontSize: 30,
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
  verificationCard: {
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
  },
  verifiedCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  invalidCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  verificationIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedIcon: {
    backgroundColor: '#DCFCE7',
  },
  invalidIcon: {
    backgroundColor: '#FEE2E2',
  },
  verificationTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  verifiedText: {
    color: '#166534',
  },
  invalidText: {
    color: '#991B1B',
  },
  verificationSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 3,
    fontWeight: '700',
  },
  checkGrid: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  checkItem: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  checkEmoji: {
    fontSize: 16,
  },
  checkText: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '900',
    marginTop: 4,
  },
  verificationMessage: {
    fontSize: 13,
    color: '#374151',
    marginTop: 10,
    lineHeight: 19,
    fontWeight: '600',
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
    marginBottom: 6,
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
  signatureText: {
    marginTop: 6,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 14,
    fontSize: 12,
    lineHeight: 18,
    color: '#2563EB',
    fontWeight: '700',
  },
  emptyProof: {
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emptyProofText: {
    color: '#9A3412',
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
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
  statusCard: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 18,
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusText: {
    color: '#166534',
    fontWeight: '900',
    fontSize: 14,
  },
});