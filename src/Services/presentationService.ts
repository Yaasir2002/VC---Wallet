import { agent } from '../veramo/agent';
import { ModularCredential } from '../types/vc';
import { safeLogger } from '../utils/safeLogger';
import { base64UrlEncode, createLocalDevelopmentJWT } from '../utils/jwtUtils';

function extractCredentialJWT(vc: any): string {
  if (!vc) return '';

  if (typeof vc === 'string') {
    return vc;
  }

  return (
    vc?.jwt ||
    vc?.proof?.jwt ||
    vc?.vc?.jwt ||
    vc?.vc?.proof?.jwt ||
    vc?.verifiableCredential ||
    ''
  );
}

export async function createSignedPresentationJWT(params: {
  holderDid: string;
  credentials: ModularCredential[];
}) {
  if (!params.holderDid) {
    throw new Error('Holder DID belum tersedia');
  }

  if (!params.credentials || params.credentials.length === 0) {
    throw new Error('Credential belum tersedia');
  }

  const credentialJWTs = params.credentials
    .map(extractCredentialJWT)
    .filter((jwt): jwt is string => typeof jwt === 'string' && jwt.length > 0);

  if (credentialJWTs.length === 0) {
    safeLogger.warn('Presentation failed: no JWT found in selected credentials');

    throw new Error(
      'Credential belum memiliki JWT. Hapus credential lama lalu buat/import credential baru dengan format JWT.'
    );
  }

  const presentation = {
    holder: params.holderDid,
    type: ['VerifiablePresentation'],
    verifiableCredential: credentialJWTs,
  };

  let vpJwt = '';

  try {
    const result: any = await agent.createVerifiablePresentation({
      presentation,
      proofFormat: 'jwt',
    });

    vpJwt =
      typeof result === 'string'
        ? result
        : result?.proof?.jwt ||
          result?.jwt ||
          result?.verifiablePresentation ||
          '';

    if (!vpJwt) {
      throw new Error('VP JWT tidak ditemukan dari hasil Veramo');
    }
  } catch (error) {
    safeLogger.warn('Veramo VP signing failed, using unsigned development fallback');

    vpJwt = createLocalDevelopmentJWT({
      iss: params.holderDid,
      sub: params.holderDid,
      nbf: Math.floor(Date.now() / 1000),
      vp: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        ...presentation,
      },
    });
  }

  return {
    id: `vp-${Date.now()}`,
    holder: params.holderDid,
    type: ['VerifiablePresentation'],
    createdAt: new Date().toISOString(),
    jwt: vpJwt,
  };
}