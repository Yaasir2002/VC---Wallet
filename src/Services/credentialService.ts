import { VerifiableCredentialV2 } from '../types/vc';
import { signVcJwtWithWallet } from './walletJwtSigner';

export type CreateCredentialParams = {
  subjectDid: string;
  documentId: string;
  documentType: 'KTP' | 'KTM' | 'SIM' | 'IJAZAH' | 'CUSTOM';
  documentName: string;
  attributeType?: string;
  attributeName?: string;
  attributeValue?: string;
  validFrom?: string;
  validUntil?: string;
  issuanceDate?: string;
  expirationDate?: string;
  credentialSubject?: Record<string, unknown>;
};

export async function createCredential(
  params: CreateCredentialParams
): Promise<VerifiableCredentialV2> {
  const issuanceDate =
    params.issuanceDate || params.validFrom || new Date().toISOString();

  const expirationDate = params.expirationDate || params.validUntil;

  const signed = await signVcJwtWithWallet({
    subjectDid: params.subjectDid,
    documentId: params.documentId,
    documentType: params.documentType,
    documentName: params.documentName,
    attributeType: params.attributeType,
    attributeName: params.attributeName,
    attributeValue: params.attributeValue,
    validFrom: params.validFrom,
    validUntil: params.validUntil,
    issuanceDate,
    expirationDate,
    credentialSubject: params.credentialSubject,
  });

  const credentialSubject = {
    id: params.subjectDid,
    documentId: params.documentId,
    documentType: params.documentType,
    documentName: params.documentName,
    ...(params.attributeType ? { attributeType: params.attributeType } : {}),
    ...(params.attributeName ? { attributeName: params.attributeName } : {}),
    ...(params.attributeValue ? { attributeValue: params.attributeValue } : {}),
    ...(params.credentialSubject || {}),
  };

  return {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://www.w3.org/ns/credentials/examples/v2',
    ],
    id: `credential-${params.documentId}-${Date.now()}`,
    documentId: params.documentId,
    documentType: params.documentType,
    documentName: params.documentName,
    type: ['VerifiableCredential'],
    issuer: signed.issuer,
    issuanceDate,
    expirationDate,
    validFrom: params.validFrom || issuanceDate,
    validUntil: params.validUntil || expirationDate,
    verificationStatus: 'self_signed',
    credentialSubject,
    proof: {
      type: 'JwtProof2020',
      created: issuanceDate,
      proofPurpose: 'assertionMethod',
      verificationMethod: signed.issuerDid,
      jwt: signed.jwt,
    },
    jwt: signed.jwt,
  };
}

export async function createCredentialWithWallet(
  params: CreateCredentialParams
): Promise<VerifiableCredentialV2> {
  return createCredential(params);
}