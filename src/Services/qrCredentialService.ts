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
  normalizedCredentials: ModularCredential[];
  preview: {
    credentialName: string;
    issuer: string;
    subject: string;
    issuanceDate: string;
    expirationDate?: string;
    mainClaims: {
      label: string;
      value: string;
    }[];
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
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '='
    );

    const decoded = atob(padded);

    return decoded || null;
  } catch {
    return null;
  }
}

function isJwtCredentialString(value: string): boolean {
  const parts = value.trim().split('.');

  if (parts.length !== 3) {
    return false;
  }

  return parts.every((part) => part.length > 0);
}

function decodeJwtPayload(jwt: string): any | null {
  try {
    const payload = jwt.split('.')[1];

    if (!payload) {
      return null;
    }

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '='
    );

    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function decodeJwtHeader(jwt: string): any | null {
  try {
    const header = jwt.split('.')[0];

    if (!header) {
      return null;
    }

    const base64 = header.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '='
    );

    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function normalizeJwtCredentialPayload(jwt: string): RawCredential {
  const header = decodeJwtHeader(jwt);
  const payload = decodeJwtPayload(jwt);

  if (!payload) {
    throw new Error('JWT credential tidak dapat dibaca');
  }

  const vc = payload.vc;

  if (!vc || typeof vc !== 'object' || Array.isArray(vc)) {
    throw new Error('JWT tidak berisi Verifiable Credential');
  }

  const issuer = vc.issuer || payload.iss;
  const issuanceDate =
    vc.issuanceDate ||
    (typeof payload.iat === 'number'
      ? new Date(payload.iat * 1000).toISOString()
      : undefined);

  const expirationDate =
    vc.expirationDate ||
    (typeof payload.exp === 'number'
      ? new Date(payload.exp * 1000).toISOString()
      : undefined);

  const validFrom =
    vc.validFrom ||
    (typeof payload.nbf === 'number'
      ? new Date(payload.nbf * 1000).toISOString()
      : undefined);

  const verificationMethod =
    typeof header?.kid === 'string'
      ? header.kid
      : issuer
        ? `${issuer}#key-1`
        : '-';

  return {
    ...vc,
    id: vc.id || payload.jti || `jwt-vc-${Date.now()}`,
    issuer,
    issuanceDate,
    expirationDate,
    validFrom,
    jwt,
    proof: {
      type: 'JwtProof2020',
      jwt,
      created: issuanceDate || new Date().toISOString(),
      proofPurpose: 'assertionMethod',
      verificationMethod,
    },
  };
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
  const hasProofOrJwt = Boolean(
    value.jwt ||
      value.proof?.jwt ||
      value.proof?.jws ||
      value.proof
  );

  return Boolean(
    hasVCType &&
      hasIssuer &&
      hasSubject &&
      (hasDate || hasProofOrJwt)
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

function getMainClaims(subject: any): { label: string; value: string }[] {
  if (!subject || typeof subject !== 'object') {
    return [];
  }

  return Object.entries(subject)
    .filter(([key]) => key !== 'id')
    .slice(0, 20)
    .map(([key, value]) => ({
      label: sanitizeText(key),
      value: sanitizeText(value),
    }))
    .filter((claim) => claim.label && claim.value);
}

function inferAttributeType(label: string): AttributeType {
  const normalized = label.toLowerCase();

  if (
    normalized.includes('namalengkap') ||
    normalized.includes('nama_lengkap') ||
    normalized.includes('nama lengkap') ||
    normalized.includes('name') ||
    normalized.includes('nama')
  ) {
    return 'legalName';
  }

  if (normalized.includes('nik')) {
    return 'nik';
  }

  if (normalized.includes('student') || normalized.includes('nim')) {
    return 'studentId';
  }

  if (
    normalized.includes('prodi') ||
    normalized.includes('programstudi') ||
    normalized.includes('program_studi') ||
    normalized.includes('program studi') ||
    normalized.includes('studyprogram')
  ) {
    return 'studyProgram';
  }

  if (
    normalized.includes('angkatan') ||
    normalized.includes('enrollment') ||
    normalized.includes('tahunmasuk') ||
    normalized.includes('tahun_masuk')
  ) {
    return 'enrollmentYear';
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
    relevantText.includes('nim') ||
    relevantText.includes('prodi') ||
    relevantText.includes('angkatan')
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

async function createDocumentId(
  vc: RawCredential,
  documentType: DocumentType,
  baseCredentialId: string
): Promise<string> {
  if (typeof vc.documentId === 'string' && vc.documentId.trim()) {
    return vc.documentId;
  }

  const source = JSON.stringify({
    id: vc.id,
    issuer: vc.issuer,
    subject: vc.credentialSubject?.id,
    issuanceDate: vc.issuanceDate || vc.validFrom,
    type: vc.type,
  });

  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    source
  );

  return `${documentType}-QR-${baseCredentialId
    .replace(/[^a-zA-Z0-9-_]/g, '')
    .slice(-12)}-${hash.slice(0, 12)}`;
}

async function createAttributeCredentialId(
  baseCredentialId: string,
  claimLabel: string,
  claimValue: string
): Promise<string> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${baseCredentialId}:${claimLabel}:${claimValue}`
  );

  return `${baseCredentialId}-${claimLabel
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .slice(0, 32)}-${hash.slice(0, 8)}`;
}

async function buildModularCredentialsFromClaims(params: {
  rawCredential: RawCredential;
  baseCredentialId: string;
  documentId: string;
  documentType: DocumentType;
  documentName: string;
  issuer: string;
  subject: string;
  issuanceDate: string;
  expirationDate?: string;
  mainClaims: {
    label: string;
    value: string;
  }[];
}): Promise<ModularCredential[]> {
  const {
    rawCredential,
    baseCredentialId,
    documentId,
    documentType,
    documentName,
    issuer,
    subject,
    issuanceDate,
    expirationDate,
    mainClaims,
  } = params;

  const claims =
    mainClaims.length > 0
      ? mainClaims
      : [
          {
            label: 'Credential Data',
            value: sanitizeText(rawCredential.credentialSubject, 'Credential Data'),
          },
        ];

  const credentials: ModularCredential[] = [];

  for (const claim of claims) {
    const id = await createAttributeCredentialId(
      baseCredentialId,
      claim.label,
      claim.value
    );

    credentials.push({
      id,
      documentId,
      documentType,
      documentName,
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
        attributeType: inferAttributeType(claim.label),
        attributeName: claim.label,
        attributeValue: claim.value,
      },
      proof: rawCredential.proof,
      jwt: rawCredential.jwt || rawCredential.proof?.jwt,
      verificationStatus: 'pending_verification',
    });
  }

  return credentials;
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
  const baseCredentialId = await createStableCredentialId(rawCredential);
  const documentType = inferDocumentType(rawCredential);
  const documentId = await createDocumentId(
    rawCredential,
    documentType,
    baseCredentialId
  );

  const normalizedCredentials = await buildModularCredentialsFromClaims({
    rawCredential,
    baseCredentialId,
    documentId,
    documentType,
    documentName: credentialName,
    issuer,
    subject,
    issuanceDate,
    expirationDate,
    mainClaims,
  });

  const normalizedCredential = normalizedCredentials[0];

  if (!normalizedCredential) {
    throw new Error('Credential tidak memiliki atribut yang dapat disimpan');
  }

  return {
    rawCredential,
    normalizedCredential,
    normalizedCredentials,
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

  if (isJwtCredentialString(trimmed)) {
    return normalizeJwtCredentialPayload(trimmed);
  }

  const directJSON = tryParseJSON(trimmed);

  if (directJSON) {
    return directJSON;
  }

  const decodedBase64 = tryDecodeBase64(trimmed);

  if (decodedBase64) {
    if (isJwtCredentialString(decodedBase64)) {
      return normalizeJwtCredentialPayload(decodedBase64);
    }

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

    if (typeof offer === 'string' && isJwtCredentialString(offer)) {
      return normalizeJwtCredentialPayload(offer);
    }

    if (typeof offer === 'string' && isHttpUrl(offer)) {
      return await fetchJSONWithTimeout(offer);
    }

    if (typeof offer === 'object') {
      if (offer.jwt && isJwtCredentialString(offer.jwt)) {
        return normalizeJwtCredentialPayload(offer.jwt);
      }

      if (offer.rawJwt && isJwtCredentialString(offer.rawJwt)) {
        return normalizeJwtCredentialPayload(offer.rawJwt);
      }

      if (offer.vcJwt && isJwtCredentialString(offer.vcJwt)) {
        return normalizeJwtCredentialPayload(offer.vcJwt);
      }

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
  const credentialsToSave =
    parsedCredential.normalizedCredentials?.length > 0
      ? parsedCredential.normalizedCredentials
      : [parsedCredential.normalizedCredential];

  let firstSavedCredential: ModularCredential | null = null;
  let savedCount = 0;

  for (const credential of credentialsToSave) {
    const isDuplicate = await isCredentialAlreadySaved(credential);

    if (isDuplicate) {
      continue;
    }

    const result = await importCredentialSecurely({
      ...credential,
      source: parsedCredential.source,
      importedAt: parsedCredential.importedAt,
      rawCredential: parsedCredential.rawCredential,
      parsedCredential: parsedCredential.preview,
    });

    if (!firstSavedCredential) {
      firstSavedCredential = result.credential;
    }

    savedCount += 1;
  }

  if (!firstSavedCredential || savedCount === 0) {
    throw new Error('Semua atribut credential sudah tersimpan sebelumnya');
  }

  return firstSavedCredential;
}