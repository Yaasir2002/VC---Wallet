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
import { saveVC } from '../../src/Storage/vcStorage';

export default function ImportCredentialScreen() {
  const router = useRouter();
  const [jsonInput, setJsonInput] = useState('');
  const [loading, setLoading] = useState(false);

  function validateVC(data: any): data is VerifiableCredential {
    return (
      data &&
      typeof data.id === 'string' &&
      Array.isArray(data.type) &&
      typeof data.issuer === 'string' &&
      typeof data.issuanceDate === 'string' &&
      data.credentialSubject &&
      typeof data.credentialSubject.id === 'string'
    );
  }

  async function handleImportVC() {
    try {
      setLoading(true);

      if (!jsonInput.trim()) {
        Alert.alert('Validasi Gagal', 'JSON credential tidak boleh kosong');
        return;
      }

      const parsedData = JSON.parse(jsonInput);

      if (!validateVC(parsedData)) {
        Alert.alert(
          'Format Tidak Valid',
          'Pastikan JSON memiliki id, type, issuer, issuanceDate, dan credentialSubject.id'
        );
        return;
      }

      await saveVC(parsedData);

      Alert.alert('Berhasil', 'Credential berhasil diimport ke wallet', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch {
      Alert.alert('Error', 'Format JSON tidak valid');
    } finally {
      setLoading(false);
    }
  }

  function handleUseExample() {
    const exampleVC: VerifiableCredential = {
      id: `vc-import-${Date.now()}`,
      type: ['VerifiableCredential', 'IdentityCredential'],
      issuer: 'did:example:issuer-government',
      issuanceDate: new Date().toISOString(),
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
        jws: 'dummy-imported-signature',
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
        Paste Verifiable Credential dalam format JSON untuk disimpan ke wallet.
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
          style={styles.importButton}
          onPress={handleImportVC}
          disabled={loading}
        >
          <Ionicons name="download-outline" size={20} color="#FFFFFF" />
          <Text style={styles.importButtonText}>
            {loading ? 'Mengimport...' : 'Import Credential'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Format Minimal VC</Text>
        <Text style={styles.noteText}>
          JSON harus memiliki id, type, issuer, issuanceDate, dan
          credentialSubject.id agar dapat disimpan.
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
});