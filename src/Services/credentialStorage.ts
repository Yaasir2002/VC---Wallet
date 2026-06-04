// File: src/services/credentialStorage.ts

import { saveVC, getAllVCs } from '../Storage/vcStorage';
import { ClaimedJwtCredential } from '../types/credential';
import { VerifiableCredentialV2 } from '../types/vc';

function getCredentialIssuerText(issuer: VerifiableCredentialV2['issuer']): string {
  if (typeof issuer === 'string') return issuer;
  return issuer?.id || '-';
}

export async function isCredentialIdAlreadySaved(
  credentialId: string
): Promise<boolean> {
  const credentials = await getAllVCs();
  return credentials.some((credential) => credential.id === credentialId);
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

  const credentialToSave: VerifiableCredentialV2 & Record<string, unknown> = {
    ...decoded,

    id: claimed.id,
    issuer: claimed.issuer,
    credentialSubject: claimed.credentialSubject,

    rawJwt: claimed.rawJwt,
    jwt: claimed.rawJwt,
    securedCredential: claimed.rawJwt,

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

    proof: {
      type: 'JwtProof2020',
      jwt: claimed.rawJwt,
      created: decoded.issuanceDate || decoded.validFrom || now,
      proofPurpose: 'assertionMethod',
      verificationMethod: claimed.decodedHeader.kid,
      verificationStatus: 'signature_verified',
    },

    metadata: {
      schemaVersion: 'vc-data-model-v2.0',
      source: 'scan',
      verificationStatus: 'signature_verified',
      proofStatus: 'jwt_signed',
      createdAt: decoded.issuanceDate || decoded.validFrom || now,
      updatedAt: now,
      originalFormat: 'jwt-vc',
      rawJwtStored: true,
      issuer: getCredentialIssuerText(claimed.issuer),
    },
  };

  await saveVC(credentialToSave);
}