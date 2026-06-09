import { resolveDID, extractPublicKeyInfo } from './resolverService';

export type DecodedJWT = {
  header: Record<string, unknown>;
  payload: Record<string, any>;
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
  structurallyValid: boolean;
  signatureVerified: boolean;
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

const JWT_QUERY_KEYS = [
  'jwt',
  'vpJwt',
  'vcJwt',
  'presentationJwt',
  'credentialJwt',
  'token',
  'raw',
];

const JWT_OBJECT_KEYS = [
  'presentationJwt',
  'vpJwt',
  'vcJwt',
  'credentialJwt',
  'jwt',
  'token',
  'raw',
  'verifiablePresentation',
  'presentation',
  'credential',
  'verifiableCredential',
  'vc',
  'payload',
  'data',
  'qr',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function base64UrlDecodeToString(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');

  while (base64.length % 4) {
    base64 += '=';
  }

  const decoded = atob(base64);

  try {
    return decodeURIComponent(
      decoded
        .split('')
        .map((char) => `%${('00' + char.charCodeAt(0).toString(16)).slice(-2)}`)
        .join('')
    );
  } catch {
    return decoded;
  }
}

function isJwtLikeString(value: unknown): value is string {
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

function isDecodableJwtString(value: unknown): value is string {
  if (!isJwtLikeString(value)) {
    return false;
  }

  const parts = value.trim().split('.');

  try {
    JSON.parse(base64UrlDecodeToString(parts[0]));
    JSON.parse(base64UrlDecodeToString(parts[1]));
    return true;
  } catch {
    return false;
  }
}

export function tryParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function tryDecodeBase64UrlOrBase64(value: string): string | null {
  try {
    const normalized = value.trim();

    if (!normalized || normalized.length < 8) {
      return null;
    }

    if (!/^[A-Za-z0-9+/_=-]+$/.test(normalized)) {
      return null;
    }

    const decoded = base64UrlDecodeToString(normalized);

    if (!decoded || decoded === normalized) {
      return null;
    }

    return decoded.trim();
  } catch {
    return null;
  }
}

export function extractJwtFromUrl(value: string): string | null {
  const normalized = value.trim();

  try {
    const url = new URL(normalized);

    for (const key of JWT_QUERY_KEYS) {
      const direct = url.searchParams.get(key);

      if (!direct) {
        continue;
      }

      const decoded = decodeURIComponent(direct.trim());

      if (isDecodableJwtString(decoded)) {
        return decoded.trim();
      }

      const nested = findJwtDeep(decoded);

      if (nested) {
        return nested;
      }
    }

    const hash = url.hash?.replace(/^#/, '');

    if (hash) {
      const hashParams = new URLSearchParams(hash);

      for (const key of JWT_QUERY_KEYS) {
        const candidate = hashParams.get(key);

        if (candidate && isDecodableJwtString(candidate)) {
          return candidate.trim();
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function findJwtDeep(value: unknown, depth = 0): string | null {
  if (depth > 10) {
    return null;
  }

  if (isDecodableJwtString(value)) {
    return value.trim();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    const fromUrl = extractJwtFromUrl(trimmed);

    if (fromUrl) {
      return fromUrl;
    }

    const parsed = tryParseJson(trimmed);

    if (parsed) {
      return findJwtDeep(parsed, depth + 1);
    }

    const decoded = tryDecodeBase64UrlOrBase64(trimmed);

    if (decoded) {
      return findJwtDeep(decoded, depth + 1);
    }

    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJwtDeep(item, depth + 1);

      if (found) {
        return found;
      }
    }

    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const key of JWT_OBJECT_KEYS) {
    const candidate = value[key];
    const found = findJwtDeep(candidate, depth + 1);

    if (found) {
      return found;
    }
  }

  for (const candidate of Object.values(value)) {
    const found = findJwtDeep(candidate, depth + 1);

    if (found) {
      return found;
    }
  }

  return null;
}

function looksLikePlainCredentialJson(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  const type = value.type;
  const types = Array.isArray(type) ? type : [type];

  const hasVCType = types.some(
    (item) => typeof item === 'string' && item === 'VerifiableCredential'
  );

  return Boolean(
    hasVCType ||
      value.credentialSubject ||
      value.issuer ||
      value.issuanceDate ||
      value.validFrom
  );
}

export function extractJwtFromQrData(data: string): string {
  const normalized = typeof data === 'string' ? data.trim() : '';

  if (!normalized) {
    throw new Error('QR kosong atau tidak terbaca.');
  }

  if (isDecodableJwtString(normalized)) {
    return normalized;
  }

  const fromUrl = extractJwtFromUrl(normalized);

  if (fromUrl) {
    return fromUrl;
  }

  const parsed = tryParseJson(normalized);

  if (parsed) {
    const jwt = findJwtDeep(parsed);

    if (jwt) {
      return jwt;
    }

    if (looksLikePlainCredentialJson(parsed)) {
      throw new Error(
        'QR terbaca sebagai credential JSON biasa, tetapi tidak mengandung VC JWT. Buat ulang atau tanda tangani credential sebagai VC JWT.'
      );
    }

    throw new Error('QR terbaca sebagai JSON, tetapi tidak mengandung JWT valid.');
  }

  const decoded = tryDecodeBase64UrlOrBase64(normalized);

  if (decoded) {
    const jwt = findJwtDeep(decoded);

    if (jwt) {
      return jwt;
    }

    const decodedJson = tryParseJson(decoded);

    if (decodedJson && looksLikePlainCredentialJson(decodedJson)) {
      throw new Error(
        'QR base64 terbaca sebagai credential JSON biasa, tetapi tidak mengandung VC JWT.'
      );
    }

    throw new Error('QR base64 berhasil dibaca, tetapi tidak mengandung JWT valid.');
  }

  throw new Error('QR terbaca, tetapi tidak mengandung JWT valid.');
}

export function decodeJWT(jwtOrQrData: string): DecodedJWT {
  const normalizedJwt = isDecodableJwtString(jwtOrQrData)
    ? jwtOrQrData.trim()
    : extractJwtFromQrData(jwtOrQrData);

  const parts = normalizedJwt.split('.');

  if (parts.length !== 3) {
    throw new Error('JWT tidak memiliki format header.payload.signature.');
  }

  try {
    return {
      header: JSON.parse(base64UrlDecodeToString(parts[0])),
      payload: JSON.parse(base64UrlDecodeToString(parts[1])),
      signature: parts[2],
      raw: normalizedJwt,
    };
  } catch {
    throw new Error('JWT ditemukan, tetapi header atau payload tidak dapat di-decode.');
  }
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

function normalizeIssuerText(issuer: any): string {
  if (typeof issuer === 'string') return issuer;
  if (issuer?.id && typeof issuer.id === 'string') return issuer.id;
  return '-';
}

function getDirectVcPayload(payload: any): any | null {
  const types = getTypes(payload);

  const hasVcType = types.includes('VerifiableCredential');

  if (
    hasVcType &&
    payload?.credentialSubject &&
    payload?.issuer
  ) {
    return payload;
  }

  return null;
}

function getVcPayloadFromDecoded(decoded: DecodedJWT): any | null {
  if (decoded.payload?.vc && typeof decoded.payload.vc === 'object') {
    return decoded.payload.vc;
  }

  return getDirectVcPayload(decoded.payload);
}

function getIssuerFromVC(decodedPayload: any, vcPayload: any): string {
  const issuer =
    decodedPayload?.iss ||
    decodedPayload?.issuer ||
    vcPayload?.issuer;

  return normalizeIssuerText(issuer);
}

function getJwtKind(payload: any): 'vp-jwt' | 'vc-jwt' | 'unknown' {
  if (payload?.vp && typeof payload.vp === 'object') {
    return 'vp-jwt';
  }

  if (payload?.vc && typeof payload.vc === 'object') {
    return 'vc-jwt';
  }

  if (getDirectVcPayload(payload)) {
    return 'vc-jwt';
  }

  return 'unknown';
}

function extractDidFromPayload(payload: any): string {
  const issuer =
    typeof payload?.vc?.issuer === 'string'
      ? payload.vc.issuer
      : payload?.vc?.issuer?.id;

  const directIssuer =
    typeof payload?.issuer === 'string'
      ? payload.issuer
      : payload?.issuer?.id;

  const candidates = [
    payload?.iss,
    payload?.sub,
    payload?.holder,
    payload?.vp?.holder,
    payload?.vc?.credentialSubject?.id,
    payload?.credentialSubject?.id,
    issuer,
    directIssuer,
  ];

  const found = candidates.find(
    (item) => typeof item === 'string' && item.startsWith('did:')
  );

  return found || '';
}

function credentialFromVCJwt(decoded: DecodedJWT): VerifiedCredentialView {
  const vcPayload = getVcPayloadFromDecoded(decoded);

  if (!vcPayload) {
    return {
      jwt: decoded.raw,
      error: 'JWT credential tidak memiliki payload VC valid.',
    };
  }

  const credentialSubject = vcPayload?.credentialSubject || {};
  const types = getTypes(vcPayload);

  return {
    jwt: decoded.raw,
    issuer: getIssuerFromVC(decoded.payload, vcPayload),
    subject: decoded.payload?.sub || credentialSubject?.id || '-',
    type: types,
    issuanceDate:
      vcPayload?.issuanceDate ||
      vcPayload?.validFrom ||
      decoded.payload?.issuanceDate ||
      decoded.payload?.validFrom ||
      (typeof decoded.payload?.nbf === 'number'
        ? new Date(decoded.payload.nbf * 1000).toISOString()
        : '-'),
    attributeName:
      credentialSubject?.Nama ||
      credentialSubject?.name ||
      credentialSubject?.fullName ||
      credentialSubject?.attributeName ||
      credentialSubject?.documentType ||
      credentialSubject?.documentName ||
      'Credential',
    attributeValue:
      credentialSubject?.NIM ||
      credentialSubject?.nik ||
      credentialSubject?.nim ||
      credentialSubject?.attributeValue ||
      credentialSubject?.id ||
      '-',
    attributeType:
      credentialSubject?.Prodi ||
      credentialSubject?.attributeType ||
      credentialSubject?.documentType ||
      types.find((item) => item !== 'VerifiableCredential') ||
      'VC',
    credentialSubject,
  };
}

function extractCredentialJwtFromVPItem(item: any): string | null {
  if (isDecodableJwtString(item)) {
    return item.trim();
  }

  if (!isRecord(item)) {
    return null;
  }

  const id = typeof item.id === 'string' ? item.id.trim() : '';

  if (id.startsWith('data:application/vc+jwt,')) {
    const jwt = id.replace(/^data:application\/vc\+jwt,/i, '').trim();
    return isDecodableJwtString(jwt) ? jwt : null;
  }

  if (id.startsWith('data:application/vc+jwt;')) {
    const commaIndex = id.indexOf(',');
    const jwt = commaIndex >= 0 ? id.slice(commaIndex + 1).trim() : '';
    return isDecodableJwtString(jwt) ? jwt : null;
  }

  const deep = findJwtDeep(item);
  return deep && isDecodableJwtString(deep) ? deep : null;
}

function credentialsFromVPJwt(decoded: DecodedJWT): VerifiedCredentialView[] {
  const vpPayload = decoded.payload?.vp || {};
  const rawCredentialItems = toArray(vpPayload?.verifiableCredential);

  const credentialJWTs = rawCredentialItems
    .map((item) => extractCredentialJwtFromVPItem(item))
    .filter((item): item is string => Boolean(item));

  if (rawCredentialItems.length === 0) {
    return [
      {
        error: 'VP JWT tidak memiliki verifiableCredential.',
      },
    ];
  }

  if (credentialJWTs.length === 0) {
    return [
      {
        error: 'Item verifiableCredential di dalam VP bukan VC JWT valid.',
      },
    ];
  }

  return credentialJWTs.map((item) => {
    try {
      const decodedVC = decodeJWT(item);
      const kind = getJwtKind(decodedVC.payload);

      if (kind !== 'vc-jwt') {
        return {
          jwt: item,
          error: 'JWT di dalam VP tidak memiliki payload VC.',
        };
      }

      return credentialFromVCJwt(decodedVC);
    } catch {
      return {
        jwt: item,
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

function hasCredentialErrors(credentials: VerifiedCredentialView[]): boolean {
  return credentials.some((credential) => Boolean(credential.error));
}

export async function verifyPresentationJWT(
  qrData: string
): Promise<UniversalVerificationResult> {
  try {
    const jwt = extractJwtFromQrData(qrData);
    const decoded = decodeJWT(jwt);
    const kind = getJwtKind(decoded.payload);
    const holderDid = extractDidFromPayload(decoded.payload);
    const didInfo = await tryResolveDid(holderDid);

    const signatureWarning =
      'JWT berhasil dibaca. Signature cryptographic verification belum dilakukan penuh.';

    if (kind === 'vp-jwt') {
      const credentials = credentialsFromVPJwt(decoded);
      const credentialHasError = hasCredentialErrors(credentials);

      return {
        valid: !credentialHasError,
        structurallyValid: true,
        signatureVerified: false,
        kind,
        holderDid,
        decoded,
        rawJwt: jwt,
        credentials,
        ...didInfo,
        warning:
          didInfo.warning ||
          (credentialHasError
            ? 'VP JWT terbaca, tetapi ada credential yang belum valid.'
            : signatureWarning),
      };
    }

    if (kind === 'vc-jwt') {
      const credential = credentialFromVCJwt(decoded);
      const credentialHasError = Boolean(credential.error);

      return {
        valid: !credentialHasError,
        structurallyValid: true,
        signatureVerified: false,
        kind,
        holderDid,
        decoded,
        rawJwt: jwt,
        credentials: [credential],
        ...didInfo,
        warning:
          didInfo.warning ||
          (credentialHasError ? credential.error : signatureWarning),
      };
    }

    return {
      valid: false,
      structurallyValid: true,
      signatureVerified: false,
      kind: 'unknown',
      holderDid,
      decoded,
      rawJwt: jwt,
      credentials: [],
      ...didInfo,
      warning:
        didInfo.warning ||
        'JWT ditemukan dan berhasil di-decode, tetapi payload tidak memiliki field vp atau vc.',
    };
  } catch (error) {
    return {
      valid: false,
      structurallyValid: false,
      signatureVerified: false,
      kind: 'unknown',
      holderDid: '',
      credentials: [],
      warning:
        error instanceof Error
          ? error.message
          : 'QR gagal dibaca sebagai VP JWT atau VC JWT.',
    };
  }
}