import { AttributeType, ModularCredential } from '../types/vc';
import { agent } from '../veramo/agent';
import { safeLogger } from '../utils/safeLogger';
import { getOrCreateVeramoIssuerDid } from './veramoIssuerService';

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

function removeUndefinedFields<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as T;
}

function extractJwtFromVeramoResult(result: any): string {
  if (isJwtString(result)) {
    return result.trim();
  }

  const candidates = [
    result?.jwt,
    result?.proof?.jwt,
    result?.verifiableCredential,
    result?.vc?.jwt,
    result?.vc?.proof?.jwt,
  ];

  const found = candidates.find(isJwtString);

  if (!found) {
    throw new Error('JWT credential tidak ditemukan dari hasil Veramo.');
  }

  return found.trim();
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

  const issuerDid = await getOrCreateVeramoIssuerDid();

  if (!issuerDid) {
    throw new Error('Issuer DID belum tersedia');
  }

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
    const result: any = await agent.createVerifiableCredential({
      credential: credentialPayload,
      proofFormat: 'jwt',
    });

    jwt = extractJwtFromVeramoResult(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Gagal menandatangani VC dengan Veramo.';

    safeLogger.error('Veramo VC signing failed', { message });

    throw new Error(
      `Credential gagal ditandatangani oleh Veramo. Pastikan issuer DID dibuat dengan kms local dan private key tersimpan. Detail: ${message}`
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