/**
 * validators.ts
 *
 * Centralized validation helpers for form inputs, VCs, DIDs, and
 * credential payloads. All functions are pure and synchronous unless noted.
 */

// ─── String helpers ──────────────────────────────────────────────────────────

/** Returns true if value is a non-empty string after trimming. */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Trims a string or returns empty string for non-string values. */
export function safeTrim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

// ─── Email / Phone ────────────────────────────────────────────────────────────

/** Basic RFC-5322-inspired email regex (good enough for form validation). */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Validates Indonesian mobile phone numbers.
 * Format: starts with 08, 10–15 digits total.
 */
export function isValidIndonesianPhone(phone: string): boolean {
  return /^08[0-9]{8,13}$/.test(phone.trim());
}

// ─── NIK ─────────────────────────────────────────────────────────────────────

/** Validates Indonesian NIK: exactly 16 digits. */
export function isValidNik(nik: string): boolean {
  return /^[0-9]{16}$/.test(nik.trim());
}

// ─── DID ─────────────────────────────────────────────────────────────────────

/** Returns true if the string looks like a valid DID. */
export function isValidDid(value: unknown): value is string {
  return typeof value === 'string' && /^did:[a-z0-9]+:.+/i.test(value.trim());
}

/** Returns true if the string looks like a DID URL (may include path, query, fragment). */
export function isValidDidUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /^did:[a-z0-9]+:[^#?/]+(\/[^#?]*)?(#[^?]*)?(\?.*)?$/i.test(value.trim());
}

// ─── JWT ─────────────────────────────────────────────────────────────────────

/** Returns true if the string is a 3-part dot-separated JWT. */
export function isJwtString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts = value.trim().split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

// ─── URL ─────────────────────────────────────────────────────────────────────

/** Returns true if the string is a well-formed HTTPS URL. */
export function isHttpsUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Returns true if the string is an HTTP or HTTPS URL. */
export function isHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

// ─── Credential structure ────────────────────────────────────────────────────

/**
 * Minimal structural validation for a W3C Verifiable Credential object.
 * Does NOT validate signatures or trusted issuers.
 */
export function hasBasicVcStructure(data: unknown): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }

  const vc = data as Record<string, unknown>;

  const hasType = Array.isArray(vc.type)
    ? (vc.type as unknown[]).includes('VerifiableCredential')
    : vc.type === 'VerifiableCredential';

  return Boolean(
    hasType &&
      vc.issuer &&
      vc.credentialSubject &&
      (vc.issuanceDate || vc.validFrom || isJwtString(vc.jwt) || isJwtString((vc.proof as any)?.jwt))
  );
}

/**
 * Returns a human-readable summary of why a VC structure is invalid.
 * Returns null if the structure is valid.
 */
export function getVcStructureError(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return 'Data harus berupa objek JSON.';
  }

  const vc = data as Record<string, unknown>;

  const hasType = Array.isArray(vc.type)
    ? (vc.type as unknown[]).includes('VerifiableCredential')
    : vc.type === 'VerifiableCredential';

  if (!hasType) {
    return 'Field "type" harus mengandung "VerifiableCredential".';
  }

  if (!vc.issuer) {
    return 'Field "issuer" wajib ada.';
  }

  if (!vc.credentialSubject) {
    return 'Field "credentialSubject" wajib ada.';
  }

  if (!vc.issuanceDate && !vc.validFrom && !isJwtString(vc.jwt) && !isJwtString((vc.proof as any)?.jwt)) {
    return 'Field "issuanceDate" atau "validFrom" wajib ada.';
  }

  return null;
}

// ─── Payload size ────────────────────────────────────────────────────────────

/**
 * Returns true if a raw string payload exceeds the given byte limit.
 * Uses UTF-8 byte length estimation.
 */
export function isPayloadTooLarge(payload: string, maxBytes: number): boolean {
  // TextEncoder is available in React Native's Hermes runtime
  try {
    const byteLength = new TextEncoder().encode(payload).byteLength;
    return byteLength > maxBytes;
  } catch {
    // Fallback: assume 1 char ≈ 1 byte (safe overestimate for ASCII)
    return payload.length > maxBytes;
  }
}

// ─── Profile fields ──────────────────────────────────────────────────────────

export type ProfileFieldError = {
  field: string;
  message: string;
};

export interface ProfileInput {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
}

/**
 * Validates profile form fields.
 * Returns an array of field errors, or empty array if valid.
 */
export function validateProfileInput(input: ProfileInput): ProfileFieldError[] {
  const errors: ProfileFieldError[] = [];

  if (!isNonEmptyString(input.fullName)) {
    errors.push({ field: 'fullName', message: 'Nama lengkap wajib diisi.' });
  }

  if (!isNonEmptyString(input.email)) {
    errors.push({ field: 'email', message: 'Email wajib diisi.' });
  } else if (!isValidEmail(input.email!)) {
    errors.push({ field: 'email', message: 'Format email tidak valid.' });
  }

  if (isNonEmptyString(input.phoneNumber) && !isValidIndonesianPhone(input.phoneNumber!)) {
    errors.push({
      field: 'phoneNumber',
      message: 'Nomor HP harus diawali 08 dan berisi 10–15 digit.',
    });
  }

  return errors;
}
