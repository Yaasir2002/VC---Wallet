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

export function decodeJWT(jwt: string) {
  const parts = jwt.split('.');

  if (parts.length < 2) {
    throw new Error('Format JWT tidak valid');
  }

  return {
    header: JSON.parse(base64UrlDecode(parts[0])),
    payload: JSON.parse(base64UrlDecode(parts[1])),
    signature: parts[2],
  };
}

export async function verifyPresentationJWT(jwt: string) {
  const decoded = decodeJWT(jwt);

  const holderDid =
    decoded.payload?.iss ||
    decoded.payload?.sub ||
    decoded.payload?.vp?.holder ||
    decoded.payload?.holder;

  if (!holderDid) {
    throw new Error('Holder DID tidak ditemukan');
  }

  const didResolution = await resolveDID(holderDid);
  const publicKeyInfo = extractPublicKeyInfo(didResolution);

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