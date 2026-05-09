import { useCallback, useEffect, useState } from 'react';
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

import { VerifiableCredential } from '../../src/types/vc';
import { getVCById } from '../../src/Storage/vcStorage';
import {
  verifyVC,
  VCVerificationResult,
} from '../../src/Services/vcVerificationService';

import AnimatedButton from '../../components/ui/AnimatedButton';

export default function CredentialDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [credential, setCredential] = useState<VerifiableCredential | null>(
    null
  );
  const [verification, setVerification] =
    useState<VCVerificationResult | null>(null);

  async function loadCredential() {
    try {
      if (!id) return;

      const data = await getVCById(id);

      if (!data) {
        Alert.alert('Tidak ditemukan', 'Credential tidak ditemukan');
        router.back();
        return;
      }

      setCredential(data);
      setVerification(verifyVC(data));
    } catch {
      Alert.alert('Error', 'Gagal mengambil detail credential');
    }
  }

  const loadCredential = useCallback(() => {
    loadCredential();
  }, []);

  useEffect(() => {
  loadCredential();
}, [loadCredential]);

  if (!credential) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="hourglass-outline" size={36} color="#2563EB" />
        <Text style={styles.loadingText}>Memuat credential...</Text>
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
          <Text style={styles.heroLabel}>Credential Detail</Text>
          <Text style={styles.heroTitle}>
            {credential.type.includes('IdentityCredential')
              ? 'Identity VC'
              : 'Verifiable VC'}
          </Text>
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
                verification.isValid
                  ? styles.verifiedIcon
                  : styles.invalidIcon,
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
                {verification.checks.issuer ? '✅' : '❌'}
              </Text>
              <Text style={styles.checkText}>Issuer DID</Text>
            </View>

            <View style={styles.checkItem}>
              <Text style={styles.checkEmoji}>
                {verification.checks.subject ? '✅' : '❌'}
              </Text>
              <Text style={styles.checkText}>Subject</Text>
            </View>

            <View style={styles.checkItem}>
              <Text style={styles.checkEmoji}>
                {verification.checks.proof ? '✅' : '❌'}
              </Text>
              <Text style={styles.checkText}>Proof</Text>
            </View>
          </View>

          {verification.messages.map((msg, index) => (
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
        <InfoItem label="Type" value={credential.type.join(', ')} />
        <InfoItem label="Issuer" value={credential.issuer} />
        <InfoItem
          label="Issuance Date"
          value={new Date(credential.issuanceDate).toLocaleString()}
        />

        {credential.expirationDate && (
          <InfoItem
            label="Expiration Date"
            value={new Date(credential.expirationDate).toLocaleString()}
          />
        )}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconOrange}>
            <Ionicons name="person-outline" size={22} color="#F97316" />
          </View>
          <Text style={styles.sectionTitle}>Credential Subject</Text>
        </View>

        <InfoItem label="Subject DID" value={credential.credentialSubject.id} />
        <InfoItem label="Name" value={credential.credentialSubject.name ?? '-'} />
        <InfoItem label="NIK" value={credential.credentialSubject.nik ?? '-'} />
        <InfoItem
          label="Birth Date"
          value={credential.credentialSubject.birthDate ?? '-'}
        />
        <InfoItem
          label="Address"
          value={credential.credentialSubject.address ?? '-'}
        />
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconBlue}>
            <Ionicons name="key-outline" size={22} color="#2563EB" />
          </View>
          <Text style={styles.sectionTitle}>Proof</Text>
        </View>

        {credential.proof ? (
          <>
            <InfoItem label="Proof Type" value={credential.proof.type} />
            <InfoItem
              label="Proof Purpose"
              value={credential.proof.proofPurpose}
            />
            <InfoItem
              label="Verification Method"
              value={credential.proof.verificationMethod}
            />

            <Text style={styles.label}>Signature</Text>
            <Text style={styles.signatureText}>{credential.proof.jws}</Text>
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
            params: { id: credential.id },
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
    fontSize: 30,
    color: '#FFFFFF',
    fontWeight: '900',
    marginTop: 2,
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