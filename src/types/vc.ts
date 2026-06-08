// File: src/types/vc.ts

export type DocumentType = 'KTP' | 'KTM' | 'SIM' | 'IJAZAH' | 'CUSTOM';

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

export type VerificationStatus =
  | 'verified'
  | 'signature_verified'
  | 'unsigned'
  | 'self_signed'
  | 'signed_unverified'
  | 'pending_verification'
  | 'invalid'
  | 'invalid_signature'
  | 'invalid_jwt'
  | 'expired'
  | 'untrusted_issuer'
  | 'unsupported_format';

export type ProofStatus =
  | 'none'
  | 'jwt_signed'
  | 'present'
  | 'unknown';

export type CredentialSubject = {
  id?: string;
  [key: string]: unknown;
};

export type CredentialIssuer =
  | string
  | {
      id: string;
      name?: string;
      [key: string]: unknown;
    };

export type CredentialMetadata = {
  schemaVersion: 'vc-data-model-v2.0';
  source?: 'manual_ktp_form' | 'manual' | 'import' | 'scan' | 'legacy-migration' | 'qr_jwt_claim';
  verificationStatus: VerificationStatus;
  proofStatus: ProofStatus;
  createdAt: string;
  updatedAt: string;
  originalFormat?: 'vc-json-v2' | 'jwt-vc' | 'legacy' | 'unknown';
  [key: string]: unknown;
};

export type VerifiableCredentialV2 = {
  '@context': string[];
  type: string[];
  id: string;
  issuer: CredentialIssuer;
  issuanceDate: string;
  credentialSubject: CredentialSubject;

  validFrom?: string;
  validUntil?: string;
  expirationDate?: string;

  credentialStatus?: {
    type: string;
    status?: string;
    [key: string]: unknown;
  };

  metadata?: CredentialMetadata;

  /**
   * JWT credential asli hasil claim dari issuer.
   * vcJwt wajib dipakai untuk VP EnvelopedVerifiableCredential.
   */
  vcJwt?: string;
  rawJwt?: string;
  jwt?: string;
  securedCredential?: string;

  decodedHeader?: Record<string, unknown>;
  decodedCredential?: Record<string, unknown>;

  proof?: unknown;

  documentId?: string;
  documentType?: DocumentType;
  documentName?: string;
  verificationStatus?: VerificationStatus | string;
  signatureVerified?: boolean;
  verificationResult?: unknown;
  verification?: unknown;
  verifiedAt?: string | null;
  importedAt?: string;
  source?: string;
};

export type KtpFormData = {
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
  nim?: string;
};

export type CredentialDocument = {
  documentId: string;
  documentType: DocumentType;
  documentName: string;
  credentials: VerifiableCredentialV2[];
};

export type SignedCredentialEnvelope = {
  credential: VerifiableCredentialV2;
  jwt: string;
};

export type SignedPresentationJWT = {
  jwt: string;
  vpJwt?: string;
  qrPayload?: string;
  holderDid: string;
  credentialCount: number;
  createdAt?: string;
  algorithm?: string;
};

export type VerifiableCredential = VerifiableCredentialV2;
export type ModularCredential = VerifiableCredentialV2;