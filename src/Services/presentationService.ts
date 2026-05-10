import { agent } from '../veramo/agent';
import { ModularCredential } from '../types/vc';
import { safeLogger } from '../utils/safeLogger';
import { resolveDID, extractPublicKeyInfo } from './resolverService';

export type SignedPresentationJWTResult = {
  id: string;
  holder: string;
  type: ['VerifiablePresentation'];
  createdAt: string;
  jwt: string;
};

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

function extractCredentialJWT(vc: any): string {
  if (!vc) return '';

  if (isJwtString(vc)) {
    return vc.trim();
  }

  const candidates = [
    vc?.jwt,
    vc?.proof?.jwt,
    vc?.vc?.jwt,
    vc?.vc?.proof?.jwt,
    vc?.verifiableCredential,
    vc?.rawCredential?.jwt,
    vc?.rawCredential?.proof?.jwt,
  ];

  const found = candidates.find(isJwtString);

  return found ? found.trim() : '';
}

async function assertHolderDidResolvable(holderDid: string): Promise<void> {
  if (!holderDid || typeof holderDid !== 'string') {
    throw new Error('Holder DID belum tersedia.');
  }

  if (!holderDid.startsWith('did:key:')) {
    throw new Error(
      `Holder DID harus did:key agar bisa di-resolve offline. DID saat ini: ${holderDid}`
    );
  }

  const didResolution = await resolveDID(holderDid);
  const publicKeyInfo = extractPublicKeyInfo(didResolution);

  if (!publicKeyInfo.didDocument) {
    throw new Error(`Holder DID gagal di-resolve: ${holderDid}`);
  }

  const hasVerificationMethod =
    Array.isArray(publicKeyInfo.verificationMethod) &&
    publicKeyInfo.verificationMethod.length > 0;

  const hasAuthentication =
    Array.isArray(publicKeyInfo.authentication) &&
    publicKeyInfo.authentication.length > 0;

  const hasAssertionMethod =
    Array.isArray(publicKeyInfo.assertionMethod) &&
    publicKeyInfo.assertionMethod.length > 0;

  if (!hasVerificationMethod && !hasAuthentication && !hasAssertionMethod) {
    throw new Error(
      `Holder DID berhasil di-resolve, tetapi public key / verification method tidak ditemukan: ${holderDid}`
    );
  }
}

function extractVpJwtFromVeramoResult(result: any): string {
  if (isJwtString(result)) {
    return result.trim();
  }

  const candidates = [
    result?.proof?.jwt,
    result?.jwt,
    result?.verifiablePresentation,
    result?.vpJwt,
    result?.presentationJwt,
  ];

  const found = candidates.find(isJwtString);

  if (!found) {
    throw new Error('VP JWT tidak ditemukan dari hasil Veramo.');
  }

  return found.trim();
}

export async function createSignedPresentationJWT(params: {
  holderDid: string;
  credentials: ModularCredential[];
}): Promise<SignedPresentationJWTResult> {
  if (!params.holderDid) {
    throw new Error('Holder DID belum tersedia.');
  }

  if (!params.credentials || params.credentials.length === 0) {
    throw new Error('Credential belum tersedia.');
  }

  await assertHolderDidResolvable(params.holderDid);

  const credentialJWTs = params.credentials
    .map(extractCredentialJWT)
    .filter(isJwtString);

  if (credentialJWTs.length === 0) {
    safeLogger.warn('Presentation failed: no JWT found in selected credentials');

    throw new Error(
      'Credential yang dipilih belum memiliki JWT VC. Untuk demo verifier, import credential dalam format JWT VC terlebih dahulu.'
    );
  }

  const presentation = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    holder: params.holderDid,
    type: ['VerifiablePresentation'],
    verifiableCredential: credentialJWTs,
  };

  try {
    const result: any = await agent.createVerifiablePresentation({
      presentation,
      proofFormat: 'jwt',
    });

    const vpJwt = extractVpJwtFromVeramoResult(result);

    return {
      id: `vp-${Date.now()}`,
      holder: params.holderDid,
      type: ['VerifiablePresentation'],
      createdAt: new Date().toISOString(),
      jwt: vpJwt,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Gagal membuat VP JWT dengan Veramo.';

    safeLogger.error('Veramo VP signing failed', { message });

    throw new Error(
      `Gagal membuat signed VP JWT. Pastikan holder DID adalah did:key dan private key masih tersimpan. Detail: ${message}`
    );
  }
}