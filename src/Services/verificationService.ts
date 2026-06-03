import { resolveDID, extractPublicKeyInfo } from './resolverService';

export type DecodedJWT = {
  header: any;
  payload: any;
  signature: string;
  raw: string;
};

export type VerifiedCredentialView = {
  jwt?: string;
  issuer?: string;
  subject?: string;
  type?: string[];
  issuanceDate?: string;
  attributeName?: string;
  attributeValue?: string;
  attributeType?: string;
  credentialSubject?: any;
  error?: string;
};

export type UniversalVerificationResult = {
  valid: boolean;
  kind: 'vp-jwt' | 'vc-jwt' | 'unknown';
  holderDid: string;
  decoded?: DecodedJWT;
  rawJwt?: string;
  didResolution?: any;
  didDocument?: any;
  verificationMethod?: any[];
  authentication?: any[];
  assertionMethod?: any[];
  credentials: VerifiedCredentialView[];
  warning?: string;
};

function base64UrlDecode(input: string) {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');

  while (base64.length % 4) {
    base64 += '=';
  }

  return decodeURIComponent(
    atob(base64)
      .split('')
      .map((char) => `%${('00' + char.charCodeAt(0).toString(16)).slice(-2)}`)
      .join('')
  );
}

export function isJwtString(value: unknown): value is string {
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

function tryParseJson(value: string): any | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function findJwtDeep(value: unknown, depth = 0): string | null {
  if (depth > 8) {
    return null;
  }

  if (isJwtString(value)) {
    return value.trim();
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const obj = value as Record<string, unknown>;

  const priorityKeys = [
    'presentationJwt',
    'vpJwt',
    'verifiablePresentation',
    'presentation',
    'jwt',
    'credential',
    'verifiableCredential',
    'vc',
    'token',
    'raw',
    'payload',
    'data',
    'qr',
  ];

  for (const key of priorityKeys) {
    const candidate = obj[key];

    if (isJwtString(candidate)) {
      return candidate.trim();
    }
  }

  for (const key of priorityKeys) {
    const candidate = obj[key];

    if (candidate && typeof candidate === 'object') {
      const found = findJwtDeep(candidate, depth + 1);

      if (found) {
        return found;
      }
    }
  }

  for (const candidate of Object.values(obj)) {
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
  }

  throw new Error('QR tidak berisi JWT valid.');
}

export function decodeJWT(jwtOrQrData: string): DecodedJWT {
  const normalizedJwt = isJwtString(jwtOrQrData)
    ? jwtOrQrData.trim()
    : extractJwtFromQrData(jwtOrQrData);

  const parts = normalizedJwt.split('.');

  return {
    header: JSON.parse(base64UrlDecode(parts[0])),
    payload: JSON.parse(base64UrlDecode(parts[1])),
    signature: parts[2],
    raw: normalizedJwt,
  };
}

function toArray(value: any): any[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null) {
    return [];
  }

  return [value];
}

function getTypes(value: any): string[] {
  return toArray(value?.type).filter(
    (item): item is string => typeof item === 'string'
  );
}

function getIssuerFromVC(decodedPayload: any, vcPayload: any): string {
  const issuer = decodedPayload?.iss || vcPayload?.issuer;

  if (typeof issuer === 'string') {
    return issuer;
  }

  if (issuer?.id && typeof issuer.id === 'string') {
    return issuer.id;
  }

  return '-';
}

function getJwtKind(payload: any): 'vp-jwt' | 'vc-jwt' | 'unknown' {
  if (payload?.vp) {
    return 'vp-jwt';
  }

  if (payload?.vc) {
    return 'vc-jwt';
  }

  return 'unknown';
}

function extractDidFromPayload(payload: any): string {
  const candidates = [
    payload?.iss,
    payload?.sub,
    payload?.holder,
    payload?.vp?.holder,
    payload?.vc?.credentialSubject?.id,
    typeof payload?.vc?.issuer === 'string'
      ? payload?.vc?.issuer
      : payload?.vc?.issuer?.id,
  ];

  const found = candidates.find(
    (item) => typeof item === 'string' && item.startsWith('did:')
  );

  return found || '';
}

function credentialFromVCJwt(decoded: DecodedJWT): VerifiedCredentialView {
  const vcPayload = decoded.payload?.vc || {};
  const credentialSubject = vcPayload?.credentialSubject || {};

  return {
    jwt: decoded.raw,
    issuer: getIssuerFromVC(decoded.payload, vcPayload),
    subject: decoded.payload?.sub || credentialSubject?.id || '-',
    type: getTypes(vcPayload),
    issuanceDate: vcPayload?.issuanceDate || decoded.payload?.nbf || '-',
    attributeName:
      credentialSubject?.attributeName ||
      credentialSubject?.name ||
      credentialSubject?.documentType ||
      credentialSubject?.documentName ||
      'Credential',
    attributeValue:
      credentialSubject?.attributeValue ||
      credentialSubject?.nik ||
      credentialSubject?.nim ||
      credentialSubject?.id ||
      '-',
    attributeType:
      credentialSubject?.attributeType ||
      credentialSubject?.documentType ||
      'VC',
    credentialSubject,
  };
}

function credentialsFromVPJwt(decoded: DecodedJWT): VerifiedCredentialView[] {
  const credentialJWTs = toArray(decoded.payload?.vp?.verifiableCredential);

  return credentialJWTs
    .filter((jwt): jwt is string => typeof jwt === 'string')
    .map((jwt) => {
      try {
        const decodedVC = decodeJWT(jwt);
        return credentialFromVCJwt(decodedVC);
      } catch {
        return {
          jwt,
          error: 'Gagal decode VC JWT di dalam VP JWT.',
        };
      }
    });
}

async function tryResolveDid(did: string) {
  if (!did || !did.startsWith('did:key:')) {
    return {
      didResolution: null,
      didDocument: null,
      verificationMethod: [],
      authentication: [],
      assertionMethod: [],
      warning: did
        ? `DID ditemukan tetapi bukan did:key: ${did}`
        : 'DID tidak ditemukan dari JWT.',
    };
  }

  try {
    const didResolution = await resolveDID(did);
    const publicKeyInfo = extractPublicKeyInfo(didResolution);

    return {
      didResolution,
      didDocument: publicKeyInfo.didDocument,
      verificationMethod: publicKeyInfo.verificationMethod || [],
      authentication: publicKeyInfo.authentication || [],
      assertionMethod: publicKeyInfo.assertionMethod || [],
      warning: publicKeyInfo.didDocument
        ? undefined
        : `DID Document tidak ditemukan untuk ${did}`,
    };
  } catch (error) {
    return {
      didResolution: null,
      didDocument: null,
      verificationMethod: [],
      authentication: [],
      assertionMethod: [],
      warning:
        error instanceof Error
          ? error.message
          : `Gagal resolve DID ${did}`,
    };
  }
}

export async function verifyPresentationJWT(
  qrData: string
): Promise<UniversalVerificationResult> {
  const jwt = extractJwtFromQrData(qrData);
  const decoded = decodeJWT(jwt);
  const kind = getJwtKind(decoded.payload);
  const holderDid = extractDidFromPayload(decoded.payload);
  const didInfo = await tryResolveDid(holderDid);

  if (kind === 'vp-jwt') {
    return {
      valid: true,
      kind,
      holderDid,
      decoded,
      rawJwt: jwt,
      credentials: credentialsFromVPJwt(decoded),
      ...didInfo,
    };
  }

  if (kind === 'vc-jwt') {
    return {
      valid: true,
      kind,
      holderDid,
      decoded,
      rawJwt: jwt,
      credentials: [credentialFromVCJwt(decoded)],
      ...didInfo,
    };
  }

  return {
    valid: false,
    kind: 'unknown',
    holderDid,
    decoded,
    rawJwt: jwt,
    credentials: [],
    warning: 'JWT ditemukan, tetapi payload tidak memiliki field vp atau vc.',
    ...didInfo,
  };
}