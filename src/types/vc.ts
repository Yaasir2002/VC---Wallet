import { CredentialSecurityStatus } from './verification';

export type AttributeType =
  | 'legalName'
  | 'birthDate'
  | 'birthPlace'
  | 'gender'
  | 'address'
  | 'religion'
  | 'maritalStatus'
  | 'occupation'
  | 'nik'
  | 'citizenship'
  | 'validUntil'
  | 'studentId'
  | 'universityName'
  | 'faculty'
  | 'studyProgram'
  | 'degree'
  | 'enrollmentYear'
  | 'studentStatus'
  | 'campusEmail'
  | 'licenseNumber'
  | 'licenseType'
  | 'educationLevel'
  | 'schoolName'
  | 'graduationYear'
  | 'major'
  | 'custom';

export type DocumentType = 'KTP' | 'KTM' | 'SIM' | 'IJAZAH' | 'CUSTOM';

export type VerificationStatus =
  | 'verified'
  | 'unsigned'
  | 'signed_unverified'
  | 'pending_verification'
  | 'invalid'
  | 'expired'
  | 'untrusted_issuer'
  | 'unsupported_format';

export type ProofStatus =
  | 'none'
  | 'present'
  | 'jwt'
  | 'data_integrity'
  | 'unknown';

export interface CredentialSubject {
  id?: string;
  [key: string]: unknown;
}

export interface CredentialIssuer {
  id: string;
  name?: string;
  [key: string]: unknown;
}

export interface CredentialStatus {
  id?: string;
  type: string;
  status?: string;
  [key: string]: unknown;
}

export interface CredentialMetadata {
  schemaVersion: 'vc-data-model-v2.0';
  source?: 'manual' | 'scan' | 'import' | 'legacy-migration' | 'wallet';
  verificationStatus: VerificationStatus;
  proofStatus?: ProofStatus;
  createdAt: string;
  updatedAt: string;
  importedAt?: string;
  originalFormat?: 'vc-v2' | 'vc-v1.1' | 'jwt-vc' | 'legacy-modular' | 'unknown';
  jwt?: string;
  documentId?: string;
  documentType?: DocumentType;
  documentName?: string;
  [key: string]: unknown;
}

export interface VerifiableCredentialV2 {
  '@context': string[];
  id: string;
  type: string[];
  issuer: CredentialIssuer;
  validFrom: string;
  validUntil?: string;
  credentialSubject: CredentialSubject;
  credentialStatus?: CredentialStatus;
  proof?: unknown;
  metadata?: CredentialMetadata;
  jwt?: string;

  /**
   * Fallback compatibility untuk credential lama.
   * Jangan dipakai untuk credential baru.
   */
  issuanceDate?: string;
  expirationDate?: string;

  /**
   * Compatibility fields agar screen lama tidak langsung rusak.
   */
  documentId?: string;
  documentType?: DocumentType;
  documentName?: string;
  verificationStatus?: CredentialSecurityStatus | VerificationStatus;
  verificationResult?: unknown;
  verification?: unknown;
  verifiedAt?: string | null;
  importedAt?: string;
  source?: string;
}

export interface VerifiablePresentationV2 {
  '@context': string[];
  id?: string;
  type: string[];
  holder: string;
  verifiableCredential: VerifiableCredentialV2[];
  metadata?: PresentationMetadata;
}

export interface PresentationMetadata {
  schemaVersion: 'vc-data-model-v2.0';
  presentationFormat: 'jwt_vp' | 'ldp_vp' | 'json_vp';
  selectedAttributes?: string[];
  createdAt: string;
}

export interface CredentialDocument {
  documentId: string;
  documentType: DocumentType;
  documentName: string;
  credentials: VerifiableCredentialV2[];
}

export type VerifiableCredential = VerifiableCredentialV2;

/**
 * Compatibility alias.
 * Kode lama masih import ModularCredential, tapi model baru adalah VC v2 utuh.
 */
export type ModularCredential = VerifiableCredentialV2;