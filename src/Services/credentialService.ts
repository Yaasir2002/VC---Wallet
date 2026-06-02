import { AttributeType, ModularCredential } from '../types/vc';
import { safeLogger } from '../utils/safeLogger';
import { createSignedVcJwtWithWalletKey } from './localJwtVcSigner';
import { getRecoverableWalletIdentity } from '../Storage/secureWalletStorage';

function removeUndefinedFields<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as T;
}

function isJwtString(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const parts = value.trim().split('.');

  return (
    parts.length === 3 &&
    parts[0].length > 0 &&
    parts[1].length > 0 &&
    parts[2].length > 0
  );
}

export async function createAttributeCredential(params: {
  subjectDid: string;
  documentId: string;
  documentType: 'KTP' | 'KTM' | 'SIM' | 'IJAZAH' | 'CUSTOM';
  documentName: string;
  attributeType: AttributeType;
  attributeName: string;
  attributeValue: string;
  expirationDate?: string;
}): Promise<ModularCredential> {
  if (!params.subjectDid) {
    throw new Error('Subject DID belum tersedia');
  }

  if (!params.subjectDid.startsWith('did:')) {
    throw new Error(`Subject DID tidak valid: ${params.subjectDid}`);
  }

  if (!params.attributeType) {
    throw new Error('Attribute type belum tersedia');
  }

  if (!params.attributeName) {
    throw new Error('Attribute name belum tersedia');
  }

  if (!params.attributeValue) {
    throw new Error('Attribute value belum tersedia');
  }

  const identity = await getRecoverableWalletIdentity();

  if (!identity?.did) {
    throw new Error('Issuer DID wallet belum tersedia.');
  }

  const issuerDid = identity.did;
  const issuanceDate = new Date().toISOString();

  const credentialPayload = removeUndefinedFields({
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    issuer: issuerDid,
    issuanceDate,
    expirationDate: params.expirationDate,
    type: ['VerifiableCredential', 'AttributeCredential'],
    credentialSubject: {
      id: params.subjectDid,
      documentId: params.documentId,
      documentType: params.documentType,
      documentName: params.documentName,
      attributeType: params.attributeType,
      attributeName: params.attributeName,
      attributeValue: params.attributeValue,
    },
  });

  let jwt = '';

  try {
    jwt = await createSignedVcJwtWithWalletKey(credentialPayload);

    if (!isJwtString(jwt)) {
      throw new Error('JWT hasil signing tidak valid.');
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Gagal menandatangani VC JWT.';

    safeLogger.error('VC JWT signing failed', { message });

    throw new Error(
      `Credential gagal ditandatangani. Detail: ${message}`
    );
  }

  return {
    id: `vc-${params.documentType}-${params.attributeType}-${Date.now()}`,
    documentId: params.documentId,
    documentType: params.documentType,
    documentName: params.documentName,
    type: ['VerifiableCredential', 'AttributeCredential'],
    issuer: issuerDid,
    issuanceDate,
    expirationDate: params.expirationDate,
    credentialSubject: {
      id: params.subjectDid,
      attributeType: params.attributeType,
      attributeName: params.attributeName,
      attributeValue: params.attributeValue,
    },
    proof: {
      type: 'JwtProof2020',
      jwt,
      created: issuanceDate,
      proofPurpose: 'assertionMethod',
      verificationMethod: issuerDid,
    },
    jwt,
  };
}