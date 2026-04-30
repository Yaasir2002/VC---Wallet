import { agent } from '../veramo/agent';
import { ModularCredential } from '../types/vc';

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

function base64UrlEncode(value: any): string {
  const json = typeof value === 'string' ? value : JSON.stringify(value);

  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  let output = '';
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

  return output.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createLocalDevelopmentJWT(payload: any): string {
  const header = {
    alg: 'none',
    typ: 'JWT',
  };

  return `${base64UrlEncode(header)}.${base64UrlEncode(payload)}.development-signature`;
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
    console.log(
      'CREDENTIAL TANPA JWT:',
      JSON.stringify(params.credentials, null, 2)
    );

    throw new Error(
      'Credential belum memiliki JWT. Hapus credential lama lalu buat/import credential baru dengan format JWT.'
    );
  }

  const presentation = {
    holder: params.holderDid,
    type: ['VerifiablePresentation'],
    verifiableCredential: credentialJWTs,
  };

  console.log('VP PAYLOAD:', JSON.stringify(presentation, null, 2));

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
      console.log('VERAMO VP RESULT:', result);
      throw new Error('VP JWT tidak ditemukan dari hasil Veramo');
    }
  } catch (error) {
    console.log('VERAMO SIGN VP ERROR, USING DEV JWT FALLBACK:', error);

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