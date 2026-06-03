import { AttributeType, ModularCredential } from '../types/vc';
import { getRecoverableWalletIdentity } from '../Storage/secureWalletStorage';
import { signVcJwtWithWallet, isJwtString } from './walletJwtSigner';
import { safeLogger } from '../utils/safeLogger';

function removeUndefinedFields<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as T;
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
    throw new Error('Subject DID belum tersedia.');
  }

  if (!params.subjectDid.startsWith('did:')) {
    throw new Error(`Subject DID tidak valid: ${params.subjectDid}`);
  }

  if (!params.documentId) {
    throw new Error('Document ID belum tersedia.');
  }

  if (!params.documentType) {
    throw new Error('Document type belum tersedia.');
  }

  if (!params.documentName) {
    throw new Error('Document name belum tersedia.');
  }

  if (!params.attributeType) {
    throw new Error('Attribute type belum tersedia.');
  }

  if (!params.attributeName) {
    throw new Error('Attribute name belum tersedia.');
  }

  if (!params.attributeValue) {
    throw new Error('Attribute value belum tersedia.');
  }

  const identity = await getRecoverableWalletIdentity();

  if (!identity?.did) {
    throw new Error('Wallet DID belum tersedia.');
  }

  const issuerDid = identity.did;
  const subjectDid = params.subjectDid;
  const issuanceDate = new Date().toISOString();

  const credentialSubject = removeUndefinedFields({
    id: subjectDid,
    documentId: params.documentId,
    documentType: params.documentType,
    documentName: params.documentName,
    attributeType: params.attributeType,
    attributeName: params.attributeName,
    attributeValue: params.attributeValue,
  });

  const type = [
    'VerifiableCredential',
    'AttributeCredential',
    `${params.documentType}Credential`,
  ];

  let jwt = '';

  try {
    jwt = await signVcJwtWithWallet({
      issuerDid,
      subjectDid,
      issuanceDate,
      expirationDate: params.expirationDate,
      type,
      credentialSubject,
    });

    if (!isJwtString(jwt)) {
      throw new Error('JWT credential hasil signing tidak valid.');
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Gagal menandatangani credential.';

    safeLogger.warn('Credential VC JWT signing failed', { message });

    throw new Error(`Credential gagal ditandatangani. Detail: ${message}`);
  }

  return {
    id: `vc-${params.documentType}-${params.attributeType}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    documentId: params.documentId,
    documentType: params.documentType,
    documentName: params.documentName,
    type,
    issuer: issuerDid,
    issuanceDate,
    expirationDate: params.expirationDate,
    verificationStatus: 'verified',
    credentialSubject: {
      id: subjectDid,
      attributeType: params.attributeType,
      attributeName: params.attributeName,
      attributeValue: params.attributeValue,
    },
    proof: {
      type: 'JwtProof2020',
      created: issuanceDate,
      proofPurpose: 'assertionMethod',
      verificationMethod: issuerDid,
      jwt,
    },
    jwt,
  };
}