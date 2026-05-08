import * as Crypto from 'expo-crypto';

import { getAllVCs } from '../Storage/vcStorage';
import { ModularCredential } from '../types/vc';
import { stableStringify } from '../utils/stableStringify';

export async function createCredentialFingerprint(
  credential: Pick<
    ModularCredential,
    'id' | 'issuer' | 'issuanceDate' | 'credentialSubject'
  >
): Promise<string> {
  const source = stableStringify({
    id: credential.id,
    issuer: credential.issuer,
    issuanceDate: credential.issuanceDate,
    credentialSubject: credential.credentialSubject,
  });

  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, source);
}

export async function isCredentialAlreadySaved(
  credential: ModularCredential
): Promise<boolean> {
  const savedCredentials = await getAllVCs();
  const targetFingerprint = await createCredentialFingerprint(credential);

  for (const savedCredential of savedCredentials) {
    if (savedCredential.id === credential.id) {
      return true;
    }

    const savedFingerprint = await createCredentialFingerprint(savedCredential);

    if (savedFingerprint === targetFingerprint) {
      return true;
    }
  }

  return false;
}