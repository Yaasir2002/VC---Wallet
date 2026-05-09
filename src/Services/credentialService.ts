import { AttributeType, ModularCredential } from "../types/vc";
import { agent } from "../veramo/agent";
import { safeLogger } from "../utils/safeLogger";
import { base64UrlEncode, createLocalDevelopmentJWT } from "../utils/jwtUtils";

async function getOrCreateIssuerDID(): Promise<string> {
  const identifiers = await agent.didManagerFind();

  if (identifiers.length > 0) {
    return identifiers[0].did;
  }

  const identifier = await agent.didManagerCreate({
    provider: "did:key",
    alias: "main-issuer",
    options: { keyType: "Ed25519" },
  });

  return identifier.did;
}

function removeUndefinedFields<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as T;
}

export async function createAttributeCredential(params: {
  subjectDid: string;
  documentId: string;
  documentType: "KTP" | "KTM" | "SIM" | "IJAZAH" | "CUSTOM";
  documentName: string;
  attributeType: AttributeType;
  attributeName: string;
  attributeValue: string;
  expirationDate?: string;
}): Promise<ModularCredential> {
  if (!params.subjectDid) {
    throw new Error("Subject DID belum tersedia");
  }

  if (!params.attributeType) {
    throw new Error("Attribute type belum tersedia");
  }

  if (!params.attributeName) {
    throw new Error("Attribute name belum tersedia");
  }

  if (!params.attributeValue) {
    throw new Error("Attribute value belum tersedia");
  }

  const issuerDid = await getOrCreateIssuerDID();

  if (!issuerDid) {
    throw new Error("Issuer DID belum tersedia");
  }

  const issuanceDate = new Date().toISOString();

  const credentialPayload = removeUndefinedFields({
    issuer: issuerDid,
    issuanceDate,
    expirationDate: params.expirationDate,
    type: ["VerifiableCredential", "AttributeCredential"],
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

  let jwt = "";

  try {
    const result: any = await agent.createVerifiableCredential({
      credential: credentialPayload,
      proofFormat: "jwt",
    });

    jwt =
      typeof result === "string"
        ? result
        : result?.proof?.jwt ||
          result?.jwt ||
          result?.verifiableCredential ||
          "";

    if (!jwt) {
      throw new Error("JWT credential tidak ditemukan dari hasil Veramo");
    }
  } catch (error) {
    safeLogger.warn("Veramo VC signing failed, using unsigned development fallback");

    jwt = createLocalDevelopmentJWT({
      iss: issuerDid,
      sub: params.subjectDid,
      nbf: Math.floor(Date.now() / 1000),
      vc: {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        ...credentialPayload,
      },
    });
  }

  return {
    id: `vc-${params.documentType}-${params.attributeType}-${Date.now()}`,
    documentId: params.documentId,
    documentType: params.documentType,
    documentName: params.documentName,
    type: ["VerifiableCredential", "AttributeCredential"],
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
      type: "JwtProof2020",
      jwt,
      created: issuanceDate,
      proofPurpose: "assertionMethod",
      verificationMethod: issuerDid,
    },
    jwt,
  };
}
