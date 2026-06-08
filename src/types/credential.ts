// File: src/types/credential.ts

import { JwtHeader } from './jwt';

export type VcCredentialSubject = {
  id?: string;
  [key: string]: unknown;
};

export type JwtVcV2Payload = {
  '@context': string[];
  type: string[];
  id: string;
  issuer: string;
  issuanceDate?: string;
  validFrom?: string;
  expirationDate?: string;
  validUntil?: string;
  credentialSubject: VcCredentialSubject;
  [key: string]: unknown;
};

export type ClaimedJwtCredential = {
  id: string;
  vcJwt: string;
  rawJwt: string;
  decodedHeader: JwtHeader;
  decodedCredential: JwtVcV2Payload;
  verificationStatus: 'signature_verified';
  signatureVerified: true;
  issuer: string;
  credentialSubject: VcCredentialSubject;
  source: 'qr_jwt_claim';
  importedAt: string;
};

export type CredentialPreviewClaim = {
  credentialType: string;
  issuer: string;
  credentialId: string;
  subjectId: string;
  subjectName?: string;
  issuanceDate?: string;
  credentialSubject: VcCredentialSubject;
  verificationStatus: 'signature_verified';
};