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

export async function createAttributeCredential(params: {
  subjectDid: string;
  attributeType: AttributeType;
  attributeName: string;
  attributeValue: string;
  expirationDate?: string;
}): Promise<ModularCredential> {
  const issuerDid = await getOrCreateIssuerDID();

  console.log('VERAMO ISSUER DID:', issuerDid);
  console.log('SUBJECT DID:', params.subjectDid);

  const credentialPayload = {
    issuer: { id: issuerDid },
    issuanceDate: new Date().toISOString(),
    expirationDate: params.expirationDate,
    type: ['VerifiableCredential', 'AttributeCredential'],
    credentialSubject: {
      id: params.subjectDid,
      attributeType: params.attributeType,
      attributeName: params.attributeName,
      attributeValue: params.attributeValue,
    },
  };

  const jwt = await agent.createVerifiableCredential({
    credential: credentialPayload,
    proofFormat: 'jwt',
  });

  return {
    id: `vc-${params.attributeType}-${Date.now()}`,
    type: ['VerifiableCredential', 'AttributeCredential'],
    issuer: issuerDid,
    issuanceDate: credentialPayload.issuanceDate,
    expirationDate: params.expirationDate,
    credentialSubject: credentialPayload.credentialSubject,
    proof: {
      type: 'JwtProof2020',
      jwt,
      created: credentialPayload.issuanceDate,
      proofPurpose: 'assertionMethod',
      verificationMethod: issuerDid,
    },
    jwt,
  };
}