import { agent } from '../veramo/agent';
import { ModularCredential, AttributeType } from '../types/vc';

async function getOrCreateIssuerDID(): Promise<string> {
  const identifiers = await agent.didManagerFind();

  if (identifiers.length > 0) {
    return identifiers[0].did;
  }

  const identifier = await agent.didManagerCreate({
    provider: 'did:ethr:sepolia',
    alias: 'main-issuer',
  });

  return identifier.did;
}

function removeUndefinedFields<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  ) as T;
}

export async function createAttributeCredential(params: {
  subjectDid: string;
  attributeType: AttributeType;
  attributeName: string;
  attributeValue: string;
  expirationDate?: string;
}): Promise<ModularCredential> {
  if (!params.subjectDid) {
    throw new Error('Subject DID belum tersedia');
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

  const issuerDid = await getOrCreateIssuerDID();

  if (!issuerDid) {
    throw new Error('Issuer DID belum tersedia');
  }

  const issuanceDate = new Date().toISOString();

  console.log('VERAMO ISSUER DID:', issuerDid);
  console.log('SUBJECT DID:', params.subjectDid);

  const credentialPayload = removeUndefinedFields({
    issuer: issuerDid,
    issuanceDate,
    expirationDate: params.expirationDate,
    type: ['VerifiableCredential', 'AttributeCredential'],
    credentialSubject: {
      id: params.subjectDid,
      attributeType: params.attributeType,
      attributeName: params.attributeName,
      attributeValue: params.attributeValue,
    },
  });

  console.log('VC PAYLOAD:', JSON.stringify(credentialPayload, null, 2));

  const result = await agent.createVerifiableCredential({
    credential: credentialPayload,
    proofFormat: 'jwt',
  });

  const jwt =
    typeof result === 'string'
      ? result
      : result?.proof?.jwt || result?.jwt || '';

  if (!jwt) {
    console.log('VERAMO VC RESULT:', result);
    throw new Error('JWT credential tidak ditemukan dari hasil Veramo');
  }

  return {
    id: `vc-${params.attributeType}-${Date.now()}`,
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