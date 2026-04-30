export type AttributeType =
  | 'legalName'
  | 'birthDate'
  | 'address'
  | 'nik'
  | 'citizenship'
  | 'studentId'
  | 'custom';

export interface ModularCredential {
  id: string;
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