// File: src/Services/credentialSigningService.ts
import { saveVC } from '../Storage/vcStorage';
import { KtpFormData, VerifiableCredentialV2 } from '../types/vc';
import {
  buildKtpDigitalCredential,
  validateKtpFormData,
} from './credentialV2Service';
import { signVcJwtWithWallet } from './walletJwtSigner';
import { getHolderDid } from './walletSigner';

export async function signCredentialAsJwt(
  credential: VerifiableCredentialV2
): Promise<string> {
  const holderDid = await getHolderDid();

  const signed = await signVcJwtWithWallet({
    subjectDid:
      typeof credential.credentialSubject?.id === 'string'
        ? credential.credentialSubject.id
        : holderDid,
    documentId:
      credential.documentId ||
      (typeof credential.credentialSubject?.documentId === 'string'
        ? credential.credentialSubject.documentId
        : credential.id),
    documentType: credential.documentType || 'CUSTOM',
    documentName: credential.documentName || 'Credential Document',
    validFrom: credential.validFrom,
    validUntil: credential.validUntil,
    credentialSubject: credential.credentialSubject,
    additionalTypes: credential.type.filter((type) => type !== 'VerifiableCredential'),
  });

  return signed.jwt;
}

export async function signAndSaveKtpCredential(
  formData: Partial<KtpFormData>
): Promise<VerifiableCredentialV2> {
  const holderDid = await getHolderDid();
  const normalized = validateKtpFormData(formData);

  const unsignedCredential = buildKtpDigitalCredential({
    formData: normalized,
    holderDid,
  });

  const jwt = await signCredentialAsJwt(unsignedCredential);

  const signedCredential = buildKtpDigitalCredential({
    formData: normalized,
    holderDid,
    jwt,
  });

  await saveVC(signedCredential);

  return signedCredential;
}