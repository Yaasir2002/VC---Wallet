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
        return `%${('00' + char.charCodeAt(0).toString(16)).slice(-2)}`;
      })
      .join('')
  );
}

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

function tryParseJson(value: string): any | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function findJwtDeep(value: unknown, depth = 0): string | null {
  if (depth > 6) {
    return null;
  }

  if (isJwtString(value)) {
    return value.trim();
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const objectValue = value as Record<string, unknown>;

  const priorityKeys = [
    'jwt',
    'vpJwt',
    'presentationJwt',
    'presentation',
    'verifiablePresentation',
    'vp',
    'token',
    'raw',
    'payload',
    'data',
    'credential',
    'vc',
  ];

  for (const key of priorityKeys) {
    const candidate = objectValue[key];

    if (isJwtString(candidate)) {
      return candidate.trim();
    }
  }

  for (const key of priorityKeys) {
    const candidate = objectValue[key];

    if (candidate && typeof candidate === 'object') {
      const found = findJwtDeep(candidate, depth + 1);

      if (found) {
        return found;
      }
    }
  }

  for (const candidate of Object.values(objectValue)) {
    if (isJwtString(candidate)) {
      return candidate.trim();
    }

    if (candidate && typeof candidate === 'object') {
      const found = findJwtDeep(candidate, depth + 1);

      if (found) {
        return found;
      }
    }
  }

  return null;
}

export function extractJwtFromQrData(data: string): string {
  const normalized = data.trim();

  if (!normalized) {
    throw new Error('QR kosong atau tidak terbaca.');
  }

  if (isJwtString(normalized)) {
    return normalized;
  }

  const parsed = tryParseJson(normalized);

  if (parsed) {
    const jwt = findJwtDeep(parsed);

    if (jwt) {
      return jwt;
    }

    throw new Error(
      'QR terbaca sebagai JSON, tetapi tidak ditemukan VP JWT. Pastikan QR berasal dari halaman Signed QR Presentation, bukan QR claim credential.'
    );
  }

  throw new Error(
    'Format QR tidak valid. QR harus berisi VP JWT murni dengan format header.payload.signature atau JSON wrapper yang memuat VP JWT.'
  );
}

export function decodeJWT(jwtOrQrData: string) {
  const normalizedJwt = extractJwtFromQrData(jwtOrQrData);
  const parts = normalizedJwt.split('.');

  return {
    header: JSON.parse(base64UrlDecode(parts[0])),
    payload: JSON.parse(base64UrlDecode(parts[1])),
    signature: parts[2],
    raw: normalizedJwt,
  };
}

function getVpTypes(vp: any): string[] {
  if (!vp?.type) {
    return [];
  }

  return Array.isArray(vp.type) ? vp.type : [vp.type];
}

function extractHolderDid(decodedPayload: any): string {
  const holderDid =
    decodedPayload?.iss ||
    decodedPayload?.sub ||
    decodedPayload?.holder ||
    decodedPayload?.vp?.holder;

  if (!holderDid || typeof holderDid !== 'string') {
    throw new Error('Holder DID tidak ditemukan di VP JWT.');
  }

  return holderDid;
}

export async function verifyPresentationJWT(qrData: string) {
  const decoded = decodeJWT(qrData);

  const vp = decoded.payload?.vp;

  if (!vp || typeof vp !== 'object') {
    throw new Error(
      'Payload JWT tidak memiliki field vp. Kemungkinan QR berisi VC JWT biasa, bukan VP JWT. Gunakan QR dari halaman Present Credential.'
    );
  }

  const vpTypes = getVpTypes(vp);

  if (!vpTypes.includes('VerifiablePresentation')) {
    throw new Error('JWT bukan Verifiable Presentation.');
  }

  const holderDid = extractHolderDid(decoded.payload);

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