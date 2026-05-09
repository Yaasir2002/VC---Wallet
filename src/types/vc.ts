import { CredentialSecurityStatus, VerificationResult } from './verification';

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

export interface ModularCredential {
  id: string;
  documentId: string;
  documentType: DocumentType;
  documentName: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  validFrom?: string;
  validUntil?: string;
  credentialSubject: {
    id: string;
    attributeType: AttributeType;
    attributeName: string;
    attributeValue: string;
  };
  proof?: unknown;
  jwt?: string;
  verificationStatus?: CredentialSecurityStatus;

  verificationResult?: unknown;
  verification?: unknown;
  verifiedAt?: string | null;
  importedAt?: string;
  source?: string;
}

export interface CredentialDocument {
  documentId: string;
  documentType: DocumentType;
  documentName: string;
  credentials: ModularCredential[];
}

export type VerifiableCredential = Record<string, any>;