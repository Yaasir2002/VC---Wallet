import * as Crypto from 'expo-crypto';

import {
  AttributeType,
  DocumentType,
  ModularCredential,
} from '../types/vc';
import { CredentialSecurityStatus } from '../types/verification';
import { importCredentialSecurely } from './credentialImportService';
import {
  assertJsonContentType,
  readResponseTextWithLimit,
  validateQrPayloadSize,
} from './qrPayloadService';
import { isCredentialAlreadySaved } from './credentialDeduplicationService';

type RawCredential = Record<string, any>;

export type ParsedScannedCredential = {
  rawCredential: RawCredential;
  normalizedCredential: ModularCredential;
  preview: {
    credentialName: string;
    issuer: string;
    subject: string;
    issuanceDate: string;
    expirationDate?: string;
    mainClaims: Array<{
      label: string;
      value: string;
    }>;
  };
  verificationStatus: CredentialSecurityStatus;
  source: 'qr_scan';
  importedAt: string;
};

const ALLOWED_DEEP_LINK_PREFIXES = [
  'openid-credential-offer://',
  'openid-vc://',
  'vcwallet://',
];

const REQUEST_TIMEOUT_MS = 10000;

function sanitizeText(value: unknown, fallback = '-'): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text =
    typeof value === 'string' ? value : JSON.stringify(value, null, 2);

  return text
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, 500);
}

function tryParseJSON(value: string): any | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function tryDecodeBase64(value: string): string | null {
  try {
    const normalized = value.trim();

    if (!/^[A-Za-z0-9+/=_-]+$/.test(normalized)) {
      return null;
    }

    const base64 = normalized.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);

    return decoded || null;
  } catch {
    return null;
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function assertSafeUrl(value: string) {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();

  if (url.protocol !== 'https:') {
    throw new Error('URL credential tidak aman. Gunakan HTTPS.');
  }

  const blockedHosts = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
  ];

  const isPrivateHost =
    blockedHosts.includes(hostname) ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    hostname.endsWith('.local') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
    hostname.startsWith('169.254.') ||
    hostname.startsWith('fe80:');

  if (isPrivateHost) {
    throw new Error('URL credential tidak diizinkan');
  }
}

function isCredentialOfferUri(value: string): boolean {
  return ALLOWED_DEEP_LINK_PREFIXES.some((prefix) =>
    value.startsWith(prefix)
  );
}

function extractCredentialOfferFromUri(value: string): any | null {
  try {
    const url = new URL(value);
    const offer =
      url.searchParams.get('credential_offer') ||
      url.searchParams.get('credential_offer_uri') ||
      url.searchParams.get('offer');

    if (!offer) {
      return null;
    }

    const decodedOffer = decodeURIComponent(offer);
    return tryParseJSON(decodedOffer) ?? decodedOffer;
  } catch {
    return null;
  }
}

async function fetchJSONWithTimeout(url: string): Promise<any> {
  assertSafeUrl(url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error('Credential offer tidak dapat diambil');
    }

    assertJsonContentType(response);

    const text = await readResponseTextWithLimit(response);
    const json = tryParseJSON(text);

    if (!json) {
      throw new Error('Response bukan JSON credential yang valid');
    }

    return json;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request credential timeout');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function looksLikeVC(value: any): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const type = value.type;
  const types = Array.isArray(type) ? type : [type];

  const hasVCType = types.some(
    (item) => typeof item === 'string' && item === 'VerifiableCredential'
  );

  const hasIssuer =
    typeof value.issuer === 'string' ||
    typeof value.issuer?.id === 'string';

  const hasSubject =
    value.credentialSubject &&
    typeof value.credentialSubject === 'object' &&
    !Array.isArray(value.credentialSubject);

  const hasDate = Boolean(value.issuanceDate || value.validFrom);
  const hasProofOrJwt = Boolean(value.jwt || value.proof?.jwt || value.proof?.jws || value.proof);

  return Boolean(hasVCType && hasIssuer && hasSubject && (hasDate || hasProofOrJwt));
}

function getIssuerId(issuer: any): string {
  if (typeof issuer === 'string') {
    return issuer;
  }

  return issuer?.id || issuer?.name || '-';
}

function getSubjectId(subject: any): string {
  if (typeof subject?.id === 'string') {
    return subject.id;
  }

  return '-';
}

function getCredentialName(vc: RawCredential): string {
  if (typeof vc.name === 'string') {
    return sanitizeText(vc.name, 'Imported Credential');
  }

  if (typeof vc.documentName === 'string') {
    return sanitizeText(vc.documentName, 'Imported Credential');
  }

  const types = Array.isArray(vc.type) ? vc.type : [vc.type];

  const specificType = types.find(
    (item) => item && item !== 'VerifiableCredential'
  );

  return sanitizeText(specificType, 'Imported Credential');
}

function getMainClaims(subject: any): Array<{ label: string; value: string }> {
  if (!subject || typeof subject !== 'object') {
    return [];
  }

  return Object.entries(subject)
    .filter(([key]) => key !== 'id')
    .slice(0, 8)
    .map(([key, value]) => ({
      label: sanitizeText(key),
      value: sanitizeText(value),
    }));
}

function inferAttributeType(label: string): AttributeType {
  const normalized = label.toLowerCase();

  if (normalized.includes('name') || normalized.includes('nama')) {
    return 'legalName';
  }

  if (normalized.includes('nik')) {
    return 'nik';
  }

  if (normalized.includes('student') || normalized.includes('nim')) {
    return 'studentId';
  }

  if (normalized.includes('birthdate') || normalized.includes('tanggal')) {
    return 'birthDate';
  }

  if (normalized.includes('address') || normalized.includes('alamat')) {
    return 'address';
  }

  return 'custom';
}

function inferDocumentType(vc: RawCredential): DocumentType {
  const relevantText = [
    vc.name,
    vc.documentName,
    Array.isArray(vc.type) ? vc.type.join(' ') : vc.type,
    Object.keys(vc.credentialSubject || {}).join(' '),
  ]
    .join(' ')
    .toLowerCase();

  if (relevantText.includes('ktp') || relevantText.includes('nik')) {
    return 'KTP';
  }

  if (
    relevantText.includes('ktm') ||
    relevantText.includes('student') ||
    relevantText.includes('nim')
  ) {
    return 'KTM';
  }

  if (relevantText.includes('sim') || relevantText.includes('license')) {
    return 'SIM';
  }

  if (relevantText.includes('ijazah') || relevantText.includes('school')) {
    return 'IJAZAH';
  }

  return 'CUSTOM';
}

async function createStableCredentialId(vc: RawCredential): Promise<string> {
  if (typeof vc.id === 'string' && vc.id.trim()) {
    return vc.id;
  }

  const source = JSON.stringify({
    issuer: vc.issuer,
    issuanceDate: vc.issuanceDate || vc.validFrom,
    credentialSubject: vc.credentialSubject,
    proof: vc.proof,
    jwt: vc.jwt,
  });

  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    source
  );

  return `qr-vc-${hash.slice(0, 24)}`;
}

async function normalizeCredential(
  rawCredential: RawCredential
): Promise<ParsedScannedCredential> {
  if (!looksLikeVC(rawCredential)) {
    throw new Error('QR tidak berisi Verifiable Credential yang valid');
  }

  const credentialName = getCredentialName(rawCredential);
  const issuer = sanitizeText(getIssuerId(rawCredential.issuer));
  const subject = sanitizeText(getSubjectId(rawCredential.credentialSubject));
  const issuanceDate = sanitizeText(
    rawCredential.issuanceDate || rawCredential.validFrom
  );
  const expirationDate =
    rawCredential.expirationDate ||
    rawCredential.validUntil ||
    rawCredential.validTo;

  const mainClaims = getMainClaims(rawCredential.credentialSubject);
  const firstClaim = mainClaims[0];

  const id = await createStableCredentialId(rawCredential);
  const documentType = inferDocumentType(rawCredential);
  const documentId =
    rawCredential.documentId ||
    `${documentType}-QR-${id.replace(/[^a-zA-Z0-9-_]/g, '').slice(-24)}`;

  const normalizedCredential: ModularCredential = {
    id,
    documentId,
    documentType,
    documentName: credentialName,
    type: Array.isArray(rawCredential.type)
      ? rawCredential.type
      : [String(rawCredential.type)],
    issuer,
    issuanceDate,
    expirationDate,
    validFrom: rawCredential.validFrom,
    validUntil: rawCredential.validUntil,
    credentialSubject: {
      id: subject,
      attributeType: inferAttributeType(firstClaim?.label || 'custom'),
      attributeName: firstClaim?.label || 'Credential Data',
      attributeValue:
        firstClaim?.value ||
        sanitizeText(rawCredential.credentialSubject, 'Credential Data'),
    },
    proof: rawCredential.proof,
    jwt: rawCredential.jwt || rawCredential.proof?.jwt,
    verificationStatus: 'pending_verification',
  };

  return {
    rawCredential,
    normalizedCredential,
    preview: {
      credentialName,
      issuer,
      subject,
      issuanceDate,
      expirationDate: expirationDate ? sanitizeText(expirationDate) : undefined,
      mainClaims,
    },
    verificationStatus: 'pending_verification',
    source: 'qr_scan',
    importedAt: new Date().toISOString(),
  };
}

async function resolveQRPayload(qrData: string): Promise<any> {
  const trimmed = qrData.trim();

  if (!trimmed) {
    throw new Error('QR kosong');
  }

  const directJSON = tryParseJSON(trimmed);

  if (directJSON) {
    return directJSON;
  }

  const decodedBase64 = tryDecodeBase64(trimmed);

  if (decodedBase64) {
    const decodedJSON = tryParseJSON(decodedBase64);

    if (decodedJSON) {
      return decodedJSON;
    }
  }

  if (isHttpUrl(trimmed)) {
    return await fetchJSONWithTimeout(trimmed);
  }

  if (isCredentialOfferUri(trimmed)) {
    const offer = extractCredentialOfferFromUri(trimmed);

    if (!offer) {
      throw new Error('Credential offer tidak valid');
    }

    if (typeof offer === 'string' && isHttpUrl(offer)) {
      return await fetchJSONWithTimeout(offer);
    }

    if (typeof offer === 'object') {
      if (offer.credential) {
        return offer.credential;
      }

      if (offer.credential_offer_uri && isHttpUrl(offer.credential_offer_uri)) {
        return await fetchJSONWithTimeout(offer.credential_offer_uri);
      }

      if (offer.verifiableCredential) {
        return offer.verifiableCredential;
      }

      return offer;
    }
  }

  throw new Error('QR tidak berisi credential yang valid');
}

export async function parseCredentialFromQR(
  qrData: string
): Promise<ParsedScannedCredential> {
  validateQrPayloadSize(qrData);

  const payload = await resolveQRPayload(qrData);

  if (payload?.verifiableCredential) {
    return await normalizeCredential(payload.verifiableCredential);
  }

  if (payload?.credential) {
    return await normalizeCredential(payload.credential);
  }

  return await normalizeCredential(payload);
}

export async function saveScannedCredential(
  parsedCredential: ParsedScannedCredential
): Promise<ModularCredential> {
  const isDuplicate = await isCredentialAlreadySaved(
    parsedCredential.normalizedCredential
  );

  if (isDuplicate) {
    throw new Error('Credential sudah tersimpan sebelumnya');
  }

  const result = await importCredentialSecurely({
    ...parsedCredential.normalizedCredential,
    source: parsedCredential.source,
    importedAt: parsedCredential.importedAt,
    rawCredential: parsedCredential.rawCredential,
    parsedCredential: parsedCredential.preview,
  });

  return result.credential;
}