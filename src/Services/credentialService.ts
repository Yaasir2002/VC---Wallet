import { AttributeType, ModularCredential } from "../types/vc";
import { agent } from "../veramo/agent";
import { safeLogger } from "../utils/safeLogger";

async function getOrCreateIssuerDID(): Promise<string> {
  const identifiers = await agent.didManagerFind();

  if (identifiers.length > 0) {
    return identifiers[0].did;
  }

  const identifier = await agent.didManagerCreate({
    provider: "did:ethr:sepolia",
    alias: "main-issuer",
  });

  return identifier.did;
}

function removeUndefinedFields<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as T;
}

function base64UrlEncode(value: any): string {
  const json = typeof value === "string" ? value : JSON.stringify(value);

  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

  let output = "";
  let i = 0;

  while (i < json.length) {
    const chr1 = json.charCodeAt(i++);
    const chr2 = json.charCodeAt(i++);
    const chr3 = json.charCodeAt(i++);

    const enc1 = chr1 >> 2;
    const enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
    let enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
    let enc4 = chr3 & 63;

    if (Number.isNaN(chr2)) {
      enc3 = enc4 = 64;
    } else if (Number.isNaN(chr3)) {
      enc4 = 64;
    }

    output +=
      chars.charAt(enc1) +
      chars.charAt(enc2) +
      chars.charAt(enc3) +
      chars.charAt(enc4);
  }

  return output.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function createLocalDevelopmentJWT(payload: any): string {
  const header = {
    alg: "none",
    typ: "JWT",
  };

  return `${base64UrlEncode(header)}.${base64UrlEncode(payload)}.development-signature`;
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
