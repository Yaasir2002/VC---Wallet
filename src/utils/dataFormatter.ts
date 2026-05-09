/**
 * dataFormatter.ts
 *
 * Utility functions for formatting data for display in the UI.
 * All functions are pure, safe (never throw), and return display-ready strings.
 */

// ─── Date / Time ─────────────────────────────────────────────────────────────

/**
 * Formats an ISO 8601 date string for display in Indonesian locale.
 * Returns '-' for invalid or missing input.
 */
export function formatDisplayDate(
  isoDate: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!isoDate) return '-';

  try {
    const date = new Date(isoDate);

    if (isNaN(date.getTime())) return '-';

    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      ...options,
    });
  } catch {
    return '-';
  }
}

/**
 * Formats a Date object for display in Indonesian locale.
 * Returns '-' for invalid or missing input.
 */
export function formatDate(date: Date | null | undefined): string {
  if (!date) return '-';

  try {
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
}

/**
 * Formats an ISO date string into a relative label.
 * Returns a localized status string.
 */
export function formatExpirationStatus(
  expirationDate: string | null | undefined
): string {
  if (!expirationDate) return 'Tidak ada batas waktu';

  try {
    const expiry = new Date(expirationDate);
    if (isNaN(expiry.getTime())) return '-';

    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();

    if (diffMs < 0) {
      return `Kedaluwarsa ${formatDisplayDate(expirationDate)}`;
    }

    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 30) {
      return `Berlaku ${diffDays} hari lagi`;
    }

    return `Berlaku hingga ${formatDisplayDate(expirationDate)}`;
  } catch {
    return '-';
  }
}

// ─── DID shortening ──────────────────────────────────────────────────────────

/**
 * Shortens a DID for display (e.g. "did:ethr:0x1234...abcd").
 * Preserves the DID method and shows truncated identifier.
 */
export function shortenDid(did: string | null | undefined, maxLength = 32): string {
  if (!did) return '-';

  if (did.length <= maxLength) return did;

  // e.g. did:ethr:0xabcdef12345678901234567890abcdef12345678
  const parts = did.split(':');

  if (parts.length >= 3) {
    const prefix = `${parts[0]}:${parts[1]}:`;
    const id = parts.slice(2).join(':');

    if (id.length > 14) {
      return `${prefix}${id.slice(0, 6)}...${id.slice(-4)}`;
    }

    return did;
  }

  // Generic fallback
  return `${did.slice(0, 14)}...${did.slice(-6)}`;
}

// ─── String helpers ──────────────────────────────────────────────────────────

/**
 * Truncates a string to maxLength, appending "..." if truncated.
 * Safe for null/undefined input.
 */
export function truncateText(
  text: string | null | undefined,
  maxLength = 80
): string {
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * Returns user initials from a full name string.
 * Returns 'U' for missing or empty names.
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return 'U';

  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();

  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

// ─── Credential status labels ─────────────────────────────────────────────────

/**
 * Returns a human-readable Indonesian label for a credential verification status.
 */
export function getVerificationStatusLabel(status: string | undefined): string {
  switch (status) {
    case 'verified':
      return 'Terverifikasi';
    case 'unverified':
      return 'Belum Terverifikasi';
    case 'pending_verification':
      return 'Menunggu Verifikasi';
    case 'invalid':
      return 'Tidak Valid';
    case 'invalid_signature':
      return 'Signature Tidak Valid';
    case 'expired':
      return 'Kedaluwarsa';
    case 'not_yet_valid':
      return 'Belum Berlaku';
    case 'untrusted_issuer':
      return 'Issuer Tidak Terpercaya';
    case 'did_resolution_failed':
      return 'DID Gagal Diresolvasi';
    case 'public_key_not_found':
      return 'Public Key Tidak Ditemukan';
    case 'unsupported_format':
      return 'Format Tidak Didukung';
    case 'unsupported_proof_type':
      return 'Tipe Proof Tidak Didukung';
    case 'malformed_credential':
      return 'Credential Rusak';
    default:
      return 'Status Tidak Diketahui';
  }
}

/**
 * Returns the color associated with a verification status (for badge styling).
 */
export function getVerificationStatusColor(status: string | undefined): {
  background: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'verified':
      return { background: '#DCFCE7', text: '#166534', border: '#86EFAC' };
    case 'expired':
    case 'not_yet_valid':
    case 'invalid':
    case 'invalid_signature':
      return { background: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' };
    case 'untrusted_issuer':
    case 'did_resolution_failed':
    case 'public_key_not_found':
      return { background: '#FEF3C7', text: '#92400E', border: '#FCD34D' };
    default:
      return { background: '#F3F4F6', text: '#374151', border: '#D1D5DB' };
  }
}
