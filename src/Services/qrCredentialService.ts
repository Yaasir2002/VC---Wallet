import * as Crypto from 'expo-crypto';

import { getAllVCs, saveVC } from '../Storage/vcStorage';
import {
  AttributeType,
  DocumentType,
  ModularCredential,
} from '../types/vc';

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
  verificationStatus: 'pending_verification' | 'invalid';
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

  if (url.protocol !== 'https:') {
    throw new Error('URL credential harus menggunakan HTTPS');
  }

  if (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname.startsWith('192.168.') ||
    url.hostname.startsWith('10.') ||
    url.hostname.endsWith('.local')
  ) {
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
      throw new Error(`Server mengembalikan status ${response.status}`);
    }

    const text = await response.text();
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
  if (!value || typeof value !== 'object') {
    return false;
  }

  const type = value.type;
  const hasVCType =
    Array.isArray(type) && type.some((item) => item === 'VerifiableCredential');

  return Boolean(
    value.credentialSubject &&
      value.issuer &&
      type &&
      (hasVCType || typeof type === 'string') &&
      (value.issuanceDate || value.validFrom)
  );
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
  const text = JSON.stringify(vc).toLowerCase();

  if (text.includes('ktp') || text.includes('nik')) {
    return 'KTP';
  }

  if (text.includes('ktm') || text.includes('student') || text.includes('nim')) {
    return 'KTM';
  }

  if (text.includes('sim') || text.includes('license')) {
    return 'SIM';
  }

  if (text.includes('ijazah') || text.includes('school')) {
    return 'IJAZAH';
  }

  return 'CUSTOM';
}

async function createStableCredentialId(vc: RawCredential): Promise<string> {
  const source = JSON.stringify({
    id: vc.id,
    issuer: vc.issuer,
    issuanceDate: vc.issuanceDate || vc.validFrom,
    credentialSubject: vc.credentialSubject,
  });

  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    source
  );

  return vc.id || `qr-vc-${hash.slice(0, 24)}`;
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
    rawCredential.expirationDate || rawCredential.validUntil;
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
  };

  return {
    rawCredential,
    normalizedCredential,
    preview: {
      credentialName,
      issuer,
      subject,
      issuanceDate,
      expirationDate: expirationDate
        ? sanitizeText(expirationDate)
        : undefined,
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

      return offer;
    }
  }

  throw new Error('QR tidak berisi credential yang valid');
}

export async function parseCredentialFromQR(
  qrData: string
): Promise<ParsedScannedCredential> {
  const payload = await resolveQRPayload(qrData);

  if (payload?.verifiableCredential) {
    return await normalizeCredential(payload.verifiableCredential);
  }

  if (payload?.credential) {
    return await normalizeCredential(payload.credential);
  }

  return await normalizeCredential(payload);
}

export async function isCredentialAlreadySaved(
  credential: ModularCredential
): Promise<boolean> {
  const savedCredentials = await getAllVCs();

  return savedCredentials.some((item) => {
    const sameId = item.id === credential.id;

    const sameFingerprint =
      item.issuer === credential.issuer &&
      item.issuanceDate === credential.issuanceDate &&
      JSON.stringify(item.credentialSubject) ===
        JSON.stringify(credential.credentialSubject);

    return sameId || sameFingerprint;
  });
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

  return await saveVC({
    ...parsedCredential.normalizedCredential,
    source: parsedCredential.source,
    importedAt: parsedCredential.importedAt,
    verificationStatus: parsedCredential.verificationStatus,
    rawCredential: parsedCredential.rawCredential,
    parsedCredential: parsedCredential.preview,
  });
}