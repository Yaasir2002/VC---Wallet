// File: src/Services/credentialStorage.ts

import { saveVC, getAllVCs, getVCById } from '../Storage/vcStorage';
import { ClaimedJwtCredential } from '../types/credential';
import { VerifiableCredentialV2 } from '../types/vc';

export async function isCredentialIdAlreadySaved(
  credentialId: string
): Promise<boolean> {
  const credentials = await getAllVCs();
  return credentials.some((credential) => credential.id === credentialId);
}

export async function getStoredCredentialById(
  credentialId: string
): Promise<VerifiableCredentialV2 | null> {
  return getVCById(credentialId);
}

export function getCredentialJwtFromStoredCredential(
  credential: VerifiableCredentialV2 | null | undefined
): string | null {
  if (!credential) return null;

  const candidates = [
    credential.vcJwt,
    credential.rawJwt,
    credential.jwt,
    credential.securedCredential,
  ];

  const jwt = candidates.find(
    (value) =>
      typeof value === 'string' &&
      value.trim().split('.').length === 3 &&
      value.trim().length > 0
  );

  return jwt ? jwt.trim() : null;
}

export async function saveClaimedJwtCredential(
  claimed: ClaimedJwtCredential
): Promise<void> {
  const duplicate = await isCredentialIdAlreadySaved(claimed.id);

  if (duplicate) {
    throw new Error('Credential sudah tersimpan.');
  }

  const decoded = claimed.decodedCredential;
  const now = claimed.importedAt;
  const issuanceDate = decoded.issuanceDate || decoded.validFrom || now;

  const credentialToSave: VerifiableCredentialV2 & Record<string, unknown> = {
    ...decoded,

    id: claimed.id,
    issuer: claimed.issuer,
    issuanceDate,
    credentialSubject: claimed.credentialSubject,

    vcJwt: claimed.vcJwt,
    rawJwt: claimed.rawJwt,
    jwt: claimed.vcJwt,
    securedCredential: claimed.vcJwt,

    decodedHeader: claimed.decodedHeader,
    decodedCredential: claimed.decodedCredential,

    verificationStatus: 'signature_verified',
    signatureVerified: true,
    issuerDid: claimed.issuer,

    documentId: claimed.id,
    documentType: 'CUSTOM',
    documentName:
      Array.isArray(decoded.type) && decoded.type.length > 1
        ? decoded.type.filter((item) => item !== 'VerifiableCredential').join(', ')
        : 'Verified Credential',

    source: 'qr_jwt_claim',
    importedAt: now,
    verifiedAt: now,

    proof: {
      type: 'JwtProof2020',
      jwt: claimed.vcJwt,
      created: issuanceDate,
      proofPurpose: 'assertionMethod',
      verificationMethod: claimed.decodedHeader.kid,
      verificationStatus: 'signature_verified',
    },

    metadata: {
      schemaVersion: 'vc-data-model-v2.0',
      source: 'qr_jwt_claim',
      verificationStatus: 'signature_verified',
      proofStatus: 'jwt_signed',
      createdAt: issuanceDate,
      updatedAt: now,
      originalFormat: 'jwt-vc',
      rawJwtStored: true,
      vcJwtStored: true,
      issuer: claimed.issuer,
    },
  };

  await saveVC(credentialToSave);
}