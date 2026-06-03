import { AttributeType, ModularCredential } from '../types/vc';
import { signVcJwtWithWallet, isJwtString } from './walletJwtSigner';
import { safeLogger } from '../utils/safeLogger';

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
  if (!params.subjectDid?.startsWith('did:')) {
    throw new Error('Subject DID tidak valid.');
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

  if (!params.attributeName || !params.attributeValue) {
    throw new Error('Nama dan nilai atribut wajib tersedia.');
  }

  const issuanceDate = new Date().toISOString();

  try {
    const signed = await signVcJwtWithWallet({
      subjectDid: params.subjectDid,
      documentId: params.documentId,
      documentType: params.documentType,
      documentName: params.documentName,
      attributeType: params.attributeType,
      attributeName: params.attributeName,
      attributeValue: params.attributeValue,
      issuanceDate,
      expirationDate: params.expirationDate,
    });

    if (!isJwtString(signed.jwt)) {
      throw new Error('Credential tidak menghasilkan VC JWT valid.');
    }

    return {
      id: `vc-${params.documentType}-${params.attributeType}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      documentId: params.documentId,
      documentType: params.documentType,
      documentName: params.documentName,
      type: signed.type,
      issuer: signed.issuerDid,
      issuanceDate,
      expirationDate: params.expirationDate,
      verificationStatus: 'verified',
      credentialSubject: {
        id: params.subjectDid,
        attributeType: params.attributeType,
        attributeName: params.attributeName,
        attributeValue: params.attributeValue,
      },
      proof: {
        type: 'JwtProof2020',
        created: issuanceDate,
        proofPurpose: 'assertionMethod',
        verificationMethod: signed.issuerDid,
        jwt: signed.jwt,
      },
      jwt: signed.jwt,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Gagal membuat VC JWT.';

    safeLogger.warn('Failed to create signed VC JWT', { message });

    throw new Error(`Gagal membuat VC JWT signed. Detail: ${message}`);
  }
}