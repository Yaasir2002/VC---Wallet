// File: src/Services/credentialPresentationService.ts

import {
  ENVELOPED_VC_TYPE,
  MAX_PRESENTATION_JWT_BYTES,
  VC_EXAMPLES_V2_CONTEXT_URL,
  VC_V2_CONTEXT_URL,
  VP_TYPE,
} from '../config/securityLimits';
import {
  EnvelopedVerifiableCredential,
  SignedPresentationResult,
  VerifiablePresentationV2,
} from '../types/presentation';
import { VerifiableCredentialV2 } from '../types/vc';
import { createCredentialJwt } from './jwtService';
import {
  getCredentialJwtFromStoredCredential,
  getStoredCredentialById,
} from './credentialStorage';
import { getWalletSigner, isJwtString, signVerifiablePresentationJwt } from './walletSigner';

function byteLength(value: string): number {
  try {
    return new TextEncoder().encode(value).length;
  } catch {
    return value.length;
  }
}

function assertCredentialCanBePresented(credential: VerifiableCredentialV2): void {
  const isSignatureVerified =
    credential.verificationStatus === 'signature_verified' ||
    credential.signatureVerified === true ||
    credential.metadata?.verificationStatus === 'signature_verified';

  if (!isSignatureVerified) {
    throw new Error('Credential belum memiliki status signature_verified.');
  }
}

async function getVcJwtOrFallback(
  credential: VerifiableCredentialV2
): Promise<string> {
  const existingJwt = getCredentialJwtFromStoredCredential(credential);

  if (existingJwt) {
    return existingJwt;
  }

  const decodedCredential = credential.decodedCredential;

  if (decodedCredential && typeof decodedCredential === 'object') {
    try {
      const fallbackJwt = await createCredentialJwt(
        decodedCredential as VerifiableCredentialV2
      );

      if (isJwtString(fallbackJwt)) {
        return fallbackJwt;
      }
    } catch {
      throw new Error('Credential JWT tidak tersedia dan fallback signing gagal.');
    }
  }

  try {
    const fallbackJwt = await createCredentialJwt(credential);

    if (isJwtString(fallbackJwt)) {
      return fallbackJwt;
    }
  } catch {
    throw new Error('Credential JWT tidak tersedia dan fallback signing gagal.');
  }

  throw new Error('Credential JWT tidak tersedia dan fallback signing gagal.');
}

export function buildEnvelopedVerifiableCredential(
  vcJwt: string
): EnvelopedVerifiableCredential {
  if (!isJwtString(vcJwt)) {
    throw new Error('Credential JWT tidak valid.');
  }

  return {
    '@context': [VC_V2_CONTEXT_URL],
    type: [ENVELOPED_VC_TYPE],
    id: `data:application/vc+jwt,${vcJwt}`,
  };
}

export function buildVerifiablePresentationV2(params: {
  holderDid: string;
  vcJwt: string;
}): VerifiablePresentationV2 {
  if (!params.holderDid?.startsWith('did:')) {
    throw new Error('Holder DID tidak valid.');
  }

  return {
    '@context': [VC_V2_CONTEXT_URL, VC_EXAMPLES_V2_CONTEXT_URL],
    type: [VP_TYPE],
    holder: params.holderDid,
    verifiableCredential: [buildEnvelopedVerifiableCredential(params.vcJwt)],
  };
}

export async function createSignedVpJwtFromCredential(
  credential: VerifiableCredentialV2
): Promise<SignedPresentationResult> {
  assertCredentialCanBePresented(credential);

  const wallet = await getWalletSigner();
  const vcJwt = await getVcJwtOrFallback(credential);
  const vp = buildVerifiablePresentationV2({
    holderDid: wallet.did,
    vcJwt,
  });

  const vpJwt = await signVerifiablePresentationJwt(vp);

  if (!isJwtString(vpJwt)) {
    throw new Error('Signed VP JWT tidak valid.');
  }

  if (byteLength(vpJwt) > MAX_PRESENTATION_JWT_BYTES) {
    throw new Error('JWT presentation terlalu panjang. QR mungkin sulit dipindai.');
  }

  const createdAt = new Date().toISOString();

  return {
    vp,
    vpJwt,
    qrPayload: vpJwt,
    holderDid: wallet.did,
    credentialCount: 1,
    createdAt,
    algorithm: wallet.alg,
  };
}

export async function createSignedVpJwtFromCredentialId(
  credentialId: string
): Promise<SignedPresentationResult> {
  const credential = await getStoredCredentialById(credentialId);

  if (!credential) {
    throw new Error('Credential tidak ditemukan.');
  }

  return createSignedVpJwtFromCredential(credential);
}