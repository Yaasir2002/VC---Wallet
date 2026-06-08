import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { VerifiableCredential } from '../../src/types/vc';
import { importCredentialSecurely } from '../../src/Services/credentialImportService';
import { SECURITY_LIMITS } from '../../src/config/securityLimits';

const VC_V2_CONTEXT = 'https://www.w3.org/ns/credentials/v2';
const VC_EXAMPLES_V2_CONTEXT = 'https://www.w3.org/ns/credentials/examples/v2';

const MAX_CREDENTIAL_RESPONSE_BYTES =
  'MAX_CREDENTIAL_RESPONSE_BYTES' in SECURITY_LIMITS &&
  typeof SECURITY_LIMITS.MAX_CREDENTIAL_RESPONSE_BYTES === 'number'
    ? SECURITY_LIMITS.MAX_CREDENTIAL_RESPONSE_BYTES
    : 'MAX_CREDENTIAL_IMPORT_SIZE' in SECURITY_LIMITS &&
        typeof SECURITY_LIMITS.MAX_CREDENTIAL_IMPORT_SIZE === 'number'
      ? SECURITY_LIMITS.MAX_CREDENTIAL_IMPORT_SIZE
      : 20000;

export default function ImportCredentialScreen() {
  const router = useRouter();
  const [jsonInput, setJsonInput] = useState('');
  const [loading, setLoading] = useState(false);

  function validateVC(data: unknown): data is VerifiableCredential {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return false;
    }

    const credential = data as Record<string, unknown>;
    const proof = credential.proof;

    const proofJwt =
      proof && typeof proof === 'object' && !Array.isArray(proof)
        ? (proof as Record<string, unknown>).jwt
        : undefined;

    return Boolean(
      credential.credentialSubject &&
        credential.type &&
        credential.issuer &&
        (credential.issuanceDate ||
          credential.validFrom ||
          credential.jwt ||
          proofJwt)
    );
  }

  function getStatusMessage(status?: string) {
    if (status === 'verified') {
      return 'Credential berhasil diverifikasi dan disimpan ke wallet.';
    }

    if (status === 'expired') {
      return 'Credential sudah kedaluwarsa dan disimpan dengan status expired.';
    }

    if (status === 'untrusted_issuer') {
      return 'Issuer credential belum termasuk daftar terpercaya.';
    }

    if (status === 'invalid') {
      return 'Credential tidak valid dan tidak ditandai sebagai verified.';
    }

    if (status === 'invalid_signature') {
      return 'Signature credential tidak valid secara kriptografis.';
    }

    if (status === 'malformed_credential') {
      return 'Struktur credential tidak sesuai format W3C VC.';
    }

    if (status === 'did_resolution_failed') {
      return 'Tidak dapat me-resolve DID issuer. Credential disimpan sebagai unverified.';
    }

    if (status === 'public_key_not_found') {
      return 'Public key issuer tidak ditemukan. Verifikasi signature tidak dapat dilakukan.';
    }

    if (status === 'unsupported_proof_type') {
      return 'Tipe proof credential belum didukung untuk verifikasi.';
    }

    return 'Credential disimpan dengan status pending_verification karena belum lolos verifikasi cryptographic penuh.';
  }

  async function handleImportVC() {
    try {
      setLoading(true);

      const trimmedInput = jsonInput.trim();

      if (!trimmedInput) {
        Alert.alert('Validasi Gagal', 'JSON credential tidak boleh kosong');
        return;
      }

      const byteLength = new TextEncoder().encode(trimmedInput).byteLength;

      if (byteLength > MAX_CREDENTIAL_RESPONSE_BYTES) {
        Alert.alert(
          'Payload Terlalu Besar',
          `Credential JSON melebihi batas ${MAX_CREDENTIAL_RESPONSE_BYTES / 1024}KB yang diizinkan.`
        );
        return;
      }

      const parsedData = JSON.parse(trimmedInput);

      if (!validateVC(parsedData)) {
        Alert.alert(
          'Format Tidak Valid',
          'Pastikan JSON memiliki type, issuer, credentialSubject, dan issuanceDate atau validFrom.'
        );
        return;
      }

      const result = await importCredentialSecurely(parsedData);
      const status = result.verification.status;
      const reason = result.verification.reason;

      Alert.alert(
        'Credential Diproses',
        `Status: ${status}\n\n${getStatusMessage(status)}${
          reason ? `\n\nAlasan: ${reason}` : ''
        }`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Format JSON tidak valid atau credential gagal diproses'
      );
    } finally {
      setLoading(false);
    }
  }

  function handleUseExample() {
    const exampleVC: VerifiableCredential = {
      '@context': [VC_V2_CONTEXT, VC_EXAMPLES_V2_CONTEXT],
      id: `vc-import-${Date.now()}`,
      type: ['VerifiableCredential', 'IdentityCredential'],
      issuer: 'did:example:issuer-government',
      issuanceDate: new Date().toISOString(),
      expirationDate: new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000
      ).toISOString(),
      credentialSubject: {
        id: 'did:example:user',
        name: 'Budi Santoso',
        nik: '3276XXXXXXXXXXXX',
        birthDate: '2001-01-01',
        address: 'Indonesia',
      },
      proof: {
        type: 'Ed25519Signature2020',
        created: new Date().toISOString(),
        proofPurpose: 'assertionMethod',
        verificationMethod: 'did:example:issuer-government#key-1',
        jws: 'example-signature-not-for-production',
      },
    };

    setJsonInput(JSON.stringify(exampleVC, null, 2));
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back-outline" size={20} color="#111827" />
        <Text style={styles.backText}>Kembali</Text>
      </Pressable>

      <Text style={styles.title}>Import Credential</Text>

      <Text style={styles.subtitle}>
        Paste Verifiable Credential dalam format JSON untuk diproses dan
        disimpan ke wallet.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Credential JSON</Text>

        <TextInput
          style={styles.input}
          multiline
          placeholder="Paste JSON credential di sini..."
          value={jsonInput}
          onChangeText={setJsonInput}
          textAlignVertical="top"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Pressable style={styles.exampleButton} onPress={handleUseExample}>
          <Text style={styles.exampleButtonText}>Gunakan Contoh JSON</Text>
        </Pressable>

        <Pressable
          style={[styles.importButton, loading && styles.importButtonDisabled]}
          onPress={handleImportVC}
          disabled={loading}
        >
          <Ionicons name="download-outline" size={20} color="#FFFFFF" />
          <Text style={styles.importButtonText}>
            {loading ? 'Memproses...' : 'Import Credential'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Catatan Keamanan</Text>
        <Text style={styles.noteText}>
          Credential tidak otomatis dianggap verified. Sistem akan mengecek
          struktur, masa berlaku, trusted issuer, dan verifikasi cryptographic
          jika konfigurasi resolver sudah tersedia.
        </Text>
      </View>

      <View style={styles.warningCard}>
        <Ionicons name="alert-circle-outline" size={22} color="#C2410C" />
        <Text style={styles.warningText}>
          Contoh JSON hanya untuk pengujian UI. Signature contoh tidak boleh
          dianggap sebagai bukti cryptographic yang valid.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    marginBottom: 16,
  },
  backText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#4B5563',
    marginTop: 8,
    lineHeight: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginTop: 22,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  input: {
    minHeight: 260,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 14,
    padding: 14,
    fontSize: 13,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  exampleButton: {
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
  },
  exampleButtonText: {
    color: '#111827',
    fontWeight: '800',
  },
  importButton: {
    marginTop: 12,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  importButtonDisabled: {
    opacity: 0.65,
  },
  importButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  noteCard: {
    backgroundColor: '#EFF6FF',
    marginTop: 18,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E3A8A',
    marginBottom: 8,
  },
  noteText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 21,
  },
  warningCard: {
    backgroundColor: '#FFF7ED',
    marginTop: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FED7AA',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#9A3412',
    fontWeight: '700',
    lineHeight: 19,
  },
});