export type AttributeType =
  | 'legalName'
  | 'birthDate'
  | 'birthPlace'
  | 'address'
  | 'nik'
  | 'citizenship'
  | 'studentId'
  | 'licenseNumber'
  | 'licenseType'
  | 'educationLevel'
  | 'schoolName'
  | 'graduationYear'
  | 'major'
  | 'custom';

export type DocumentType = 'KTP' | 'SIM' | 'IJAZAH' | 'CUSTOM';

export interface ModularCredential {
  id: string;
  documentId: string;
  documentType: DocumentType;
  documentName: string;

  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;

  credentialSubject: {
    id: string;
    attributeType: AttributeType;
    attributeName: string;
    attributeValue: string;
  };

  proof?: {
    type: string;
    jwt?: string;
    created?: string;
    proofPurpose?: string;
    verificationMethod?: string;
  };

  jwt?: string;
}

export interface CredentialDocument {
  documentId: string;
  documentType: DocumentType;
  documentName: string;
  credentials: ModularCredential[];
}