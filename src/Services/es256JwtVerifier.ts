import { decodeJWT } from 'did-jwt';
import { SUPPORTED_JWT_ALGS } from '../config/securityLimits';

type JwtHeader = {
  alg?: string;
  typ?: string;
  kid?: string;
  [key: string]: unknown;
};

type JwtPayload = {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  vc?: unknown;
  vp?: unknown;
  [key: string]: unknown;
};

export type ES256JwtVerificationResult = {
  valid: boolean;
  structurallyValid: boolean;
  signatureVerified: boolean;
  algorithm?: string;
  issuer?: string;
  subject?: string;
  keyId?: string;
  header?: JwtHeader;
  payload?: JwtPayload;
  warning?: string;
  error?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isJwtString(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const trimmed = value.trim();
  const parts = trimmed.split('.');

  return (
    trimmed.length > 0 &&
    parts.length === 3 &&
    parts.every((part) => part.trim().length > 0)
  );
}

function normalizeDecodedJwt(decoded: unknown): {
  header: JwtHeader;
  payload: JwtPayload;
} {
  if (!isRecord(decoded)) {
    throw new Error('JWT tidak dapat didecode.');
  }

  const header = isRecord(decoded.header) ? decoded.header : {};
  const payload = isRecord(decoded.payload) ? decoded.payload : {};

  return {
    header: header as JwtHeader,
    payload: payload as JwtPayload,
  };
}

function isSupportedAlg(alg: unknown): alg is (typeof SUPPORTED_JWT_ALGS)[number] {
  return (
    typeof alg === 'string' &&
    SUPPORTED_JWT_ALGS.includes(alg as (typeof SUPPORTED_JWT_ALGS)[number])
  );
}

function isExpired(payload: JwtPayload): boolean {
  if (typeof payload.exp !== 'number') return false;

  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}

function isNotYetValid(payload: JwtPayload): boolean {
  if (typeof payload.nbf !== 'number') return false;

  const now = Math.floor(Date.now() / 1000);
  return payload.nbf > now;
}

export async function verifyES256Jwt(
  jwt: string
): Promise<ES256JwtVerificationResult> {
  try {
    if (!isJwtString(jwt)) {
      return {
        valid: false,
        structurallyValid: false,
        signatureVerified: false,
        error: 'Format JWT tidak valid.',
      };
    }

    const decoded = decodeJWT(jwt);
    const { header, payload } = normalizeDecodedJwt(decoded);

    if (!isSupportedAlg(header.alg)) {
      return {
        valid: false,
        structurallyValid: true,
        signatureVerified: false,
        algorithm: typeof header.alg === 'string' ? header.alg : undefined,
        issuer: typeof payload.iss === 'string' ? payload.iss : undefined,
        subject: typeof payload.sub === 'string' ? payload.sub : undefined,
        keyId: typeof header.kid === 'string' ? header.kid : undefined,
        header,
        payload,
        error: 'Algoritma JWT tidak didukung.',
      };
    }

    if (isExpired(payload)) {
      return {
        valid: false,
        structurallyValid: true,
        signatureVerified: false,
        algorithm: header.alg,
        issuer: typeof payload.iss === 'string' ? payload.iss : undefined,
        subject: typeof payload.sub === 'string' ? payload.sub : undefined,
        keyId: typeof header.kid === 'string' ? header.kid : undefined,
        header,
        payload,
        error: 'JWT sudah kedaluwarsa.',
      };
    }

    if (isNotYetValid(payload)) {
      return {
        valid: false,
        structurallyValid: true,
        signatureVerified: false,
        algorithm: header.alg,
        issuer: typeof payload.iss === 'string' ? payload.iss : undefined,
        subject: typeof payload.sub === 'string' ? payload.sub : undefined,
        keyId: typeof header.kid === 'string' ? header.kid : undefined,
        header,
        payload,
        error: 'JWT belum berlaku.',
      };
    }

    return {
      valid: true,
      structurallyValid: true,
      signatureVerified: false,
      algorithm: header.alg,
      issuer: typeof payload.iss === 'string' ? payload.iss : undefined,
      subject: typeof payload.sub === 'string' ? payload.sub : undefined,
      keyId: typeof header.kid === 'string' ? header.kid : undefined,
      header,
      payload,
      warning:
        'JWT berhasil dibaca secara struktur. Verifikasi signature ES256 penuh belum dilakukan di service ini.',
    };
  } catch (error) {
    return {
      valid: false,
      structurallyValid: false,
      signatureVerified: false,
      error:
        error instanceof Error
          ? error.message
          : 'Gagal memverifikasi JWT ES256.',
    };
  }
}

export async function verifyEs256Jwt(
  jwt: string
): Promise<ES256JwtVerificationResult> {
  return verifyES256Jwt(jwt);
}

export async function verifyJwtES256(
  jwt: string
): Promise<ES256JwtVerificationResult> {
  return verifyES256Jwt(jwt);
}