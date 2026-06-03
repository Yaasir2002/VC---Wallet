import {
  createVerifiableCredentialJwt,
  createVerifiablePresentationJwt,
} from 'did-jwt-vc';
import { EdDSASigner } from 'did-jwt';

import {
  getRecoverableWalletIdentity,
  getWalletPrivateKeySeedHex,
} from '../Storage/secureWalletStorage';

export function isJwtString(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim();
  const parts = normalized.split('.');

  return (
    parts.length === 3 &&
    parts[0].length > 0 &&
    parts[1].length > 0 &&
    parts[2].length > 0
  );
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;

  if (!normalized || normalized.length % 2 !== 0) {
    throw new Error('Private key seed hex tidak valid.');
  }

  if (!/^[0-9a-fA-F]+$/.test(normalized)) {
    throw new Error('Private key seed harus hexadecimal.');
  }

  const bytes = new Uint8Array(normalized.length / 2);

  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
  }

  return bytes;
}

async function getWalletSigner() {
  const identity = await getRecoverableWalletIdentity();

  if (!identity?.did) {
    throw new Error('Wallet identity / DID tidak ditemukan.');
  }

  if (!identity.did.startsWith('did:key:')) {
    throw new Error(`Wallet DID harus did:key. DID saat ini: ${identity.did}`);
  }

  const privateKeySeedHex =
    identity.privateKeySeedHex || (await getWalletPrivateKeySeedHex());

  if (!privateKeySeedHex) {
    throw new Error('Private key seed wallet tidak ditemukan.');
  }

  return {
    did: identity.did,
    signer: EdDSASigner(hexToBytes(privateKeySeedHex)),
  };
}

export async function signVcJwtWithWallet(params: {
  subjectDid: string;
  documentId: string;
  documentType: string;
  documentName: string;
  attributeType: string;
  attributeName: string;
  attributeValue: string;
  issuanceDate: string;
  expirationDate?: string;
}) {
  const wallet = await getWalletSigner();

  if (!params.subjectDid?.startsWith('did:')) {
    throw new Error('Subject DID tidak valid.');
  }

  const issuanceTime = new Date(params.issuanceDate).getTime();

  if (!params.issuanceDate || Number.isNaN(issuanceTime)) {
    throw new Error('Issuance date tidak valid.');
  }

  const credentialSubject = {
    id: params.subjectDid,
    documentId: params.documentId,
    documentType: params.documentType,
    documentName: params.documentName,
    attributeType: params.attributeType,
    attributeName: params.attributeName,
    attributeValue: params.attributeValue,
  };

  const vcTypes = [
    'VerifiableCredential',
    'AttributeCredential',
    `${params.documentType}Credential`,
  ];

  const vcPayload: any = {
    sub: params.subjectDid,
    nbf: Math.floor(issuanceTime / 1000),
    vc: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: vcTypes,
      issuer: wallet.did,
      issuanceDate: params.issuanceDate,
      credentialSubject,
    },
  };

  if (params.expirationDate) {
    const expirationTime = new Date(params.expirationDate).getTime();

    if (Number.isNaN(expirationTime)) {
      throw new Error('Expiration date tidak valid.');
    }

    vcPayload.exp = Math.floor(expirationTime / 1000);
    vcPayload.vc.expirationDate = params.expirationDate;
  }

  const jwt = await createVerifiableCredentialJwt(vcPayload, {
    did: wallet.did,
    signer: wallet.signer,
    alg: 'EdDSA',
  } as any);

  if (!isJwtString(jwt)) {
    throw new Error('VC JWT hasil signing tidak valid.');
  }

  return {
    jwt: jwt.trim(),
    issuerDid: wallet.did,
    credentialSubject,
    type: vcTypes,
  };
}

export async function signVpJwtWithWallet(params: {
  holderDid: string;
  verifiableCredential: string[];
}) {
  const wallet = await getWalletSigner();

  if (params.holderDid !== wallet.did) {
    throw new Error(
      `Holder DID harus sama dengan DID wallet. holder=${params.holderDid}, wallet=${wallet.did}`
    );
  }

  if (!Array.isArray(params.verifiableCredential)) {
    throw new Error('verifiableCredential harus berupa array VC JWT.');
  }

  if (params.verifiableCredential.length === 0) {
    throw new Error('Minimal 1 VC JWT harus dimasukkan ke VP.');
  }

  for (const vcJwt of params.verifiableCredential) {
    if (!isJwtString(vcJwt)) {
      throw new Error('Ada credential yang bukan VC JWT valid.');
    }
  }

  const vpPayload: any = {
    vp: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation'],
      holder: params.holderDid,
      verifiableCredential: params.verifiableCredential.map((jwt) =>
        jwt.trim()
      ),
    },
  };

  const jwt = await createVerifiablePresentationJwt(vpPayload, {
    did: wallet.did,
    signer: wallet.signer,
    alg: 'EdDSA',
  } as any);

  if (!isJwtString(jwt)) {
    throw new Error('VP JWT hasil signing tidak valid.');
  }

  return jwt.trim();
}