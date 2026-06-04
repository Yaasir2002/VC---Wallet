// File: src/types/vc.ts
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
  | 'self_signed'
  | 'signed_unverified'
  | 'pending_verification'
  | 'invalid'
  | 'expired'
  | 'untrusted_issuer'
  | 'unsupported_format';

export type ProofStatus =
  | 'none'
  | 'present'
  | 'jwt_signed'
  | 'jwt'
  | 'data_integrity'
  | 'unknown';

export interface CredentialSubject {
  id?: string;
  [key: string]: unknown;
}

export interface KtpCredentialSubject extends CredentialSubject {
  id: string;
  nama: string;
  nik: string;
  tempatLahir: string;
  tanggalLahir: string;
  jenisKelamin: string;
  alamat: string;
  rtRw?: string;
  kelurahanDesa?: string;
  kecamatan?: string;
  agama: string;
  statusPerkawinan: string;
  pekerjaan: string;
  kewarganegaraan: string;
  berlakuHingga: string;

  /**
   * Alias kompatibilitas untuk UI lama.
   */
  fullName?: string;
  birthPlace?: string;
  birthDate?: string;
  gender?: string;
  address?: string;
  religion?: string;
  maritalStatus?: string;
  occupation?: string;
  citizenship?: string;
  validUntilText?: string;
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
  source?:
    | 'manual_ktp_form'
    | 'manual'
    | 'scan'
    | 'import'
    | 'legacy-migration'
    | 'wallet';
  verificationStatus: VerificationStatus;
  proofStatus?: ProofStatus;
  createdAt: string;
  updatedAt: string;
  importedAt?: string;
  originalFormat?: 'vc-v2' | 'vc-v1.1' | 'jwt-vc' | 'legacy-modular' | 'unknown';
  jwt?: string;
  securedCredential?: string;
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
  securedCredential?: string;

  /**
   * Fallback baca credential lama. Jangan dipakai untuk data baru.
   */
  issuanceDate?: string;
  expirationDate?: string;

  /**
   * Field kompatibilitas UI existing.
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

export interface PresentationMetadata {
  schemaVersion: 'vc-data-model-v2.0';
  presentationFormat: 'jwt';
  selectedAttributes?: string[];
  createdAt: string;
}

export interface VerifiablePresentationV2 {
  '@context': string[];
  id?: string;
  type: string[];
  holder: string;
  verifiableCredential: VerifiableCredentialV2[];
  metadata?: PresentationMetadata;
}

export interface SignedCredentialEnvelope {
  credential: VerifiableCredentialV2;
  jwt: string;
  proofStatus: ProofStatus;
}

export interface JwtPresentationResult {
  jwt: string;
  holderDid: string;
  credentialCount: number;
  createdAt: string;
  qrPayload: string;
}

export interface KtpFormData {
  nama: string;
  nik: string;
  tempatLahir: string;
  tanggalLahir: string;
  jenisKelamin: string;
  alamat: string;
  rtRw: string;
  kelurahanDesa: string;
  kecamatan: string;
  agama: string;
  statusPerkawinan: string;
  pekerjaan: string;
  kewarganegaraan: string;
  berlakuHingga: string;
}

export interface CredentialDocument {
  documentId: string;
  documentType: DocumentType;
  documentName: string;
  credentials: VerifiableCredentialV2[];
}

export type VerifiableCredential = VerifiableCredentialV2;

/**
 * Alias agar file lama tidak langsung rusak.
 */
export type ModularCredential = VerifiableCredentialV2;