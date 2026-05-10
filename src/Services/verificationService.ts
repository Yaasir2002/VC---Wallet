import { resolveDID, extractPublicKeyInfo } from './resolverService';

function base64UrlDecode(input: string) {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');

  while (base64.length % 4) {
    base64 += '=';
  }

  return decodeURIComponent(
    atob(base64)
      .split('')
      .map((char) => {
        return '%' + ('00' + char.charCodeAt(0).toString(16)).slice(-2);
      })
      .join('')
  );
}

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

export function decodeJWT(jwt: string) {
  const normalizedJwt = jwt.trim();

  if (!isJwtString(normalizedJwt)) {
    throw new Error(
      'Format QR salah. Untuk demo verifier, QR harus berisi VP JWT murni: header.payload.signature.'
    );
  }

  const parts = normalizedJwt.split('.');

  return {
    header: JSON.parse(base64UrlDecode(parts[0])),
    payload: JSON.parse(base64UrlDecode(parts[1])),
    signature: parts[2],
    raw: normalizedJwt,
  };
}

export async function verifyPresentationJWT(jwt: string) {
  const decoded = decodeJWT(jwt);

  const vp = decoded.payload?.vp;

  if (!vp || typeof vp !== 'object') {
    throw new Error('Payload JWT tidak memiliki field vp.');
  }

  const vpTypes = Array.isArray(vp.type) ? vp.type : [vp.type];

  if (!vpTypes.includes('VerifiablePresentation')) {
    throw new Error('JWT bukan Verifiable Presentation.');
  }

  const holderDid =
    decoded.payload?.iss ||
    decoded.payload?.sub ||
    vp?.holder ||
    decoded.payload?.holder;

  if (!holderDid || typeof holderDid !== 'string') {
    throw new Error('Holder DID tidak ditemukan di VP JWT.');
  }

  if (!holderDid.startsWith('did:key:')) {
    throw new Error(
      `Holder DID harus did:key agar bisa di-resolve offline. DID saat ini: ${holderDid}`
    );
  }

  const didResolution = await resolveDID(holderDid);
  const publicKeyInfo = extractPublicKeyInfo(didResolution);

  if (!publicKeyInfo.didDocument) {
    throw new Error(`DID Document tidak ditemukan untuk ${holderDid}`);
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
      `Public key / verification method tidak ditemukan untuk ${holderDid}`
    );
  }

  return {
    valid: true,
    holderDid,
    decoded,
    didResolution,
    didDocument: publicKeyInfo.didDocument,
    verificationMethod: publicKeyInfo.verificationMethod,
    authentication: publicKeyInfo.authentication,
    assertionMethod: publicKeyInfo.assertionMethod,
  };
}