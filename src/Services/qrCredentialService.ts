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

const VC_V2_CONTEXT = 'https://www.w3.org/ns/credentials/v2';
const VC_EXAMPLES_V2_CONTEXT = 'https://www.w3.org/ns/credentials/examples/v2';

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
    '@context': Array.isArray(vc['@context'])
      ? vc['@context']
      : [VC_V2_CONTEXT, VC_EXAMPLES_V2_CONTEXT],
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
    relevantText.includes('mahasiswa')
  ) {
    return 'KTM';
  }

  if (relevantText.includes('sim') || relevantText.includes('license')) {
    return 'SIM';
  }

  if (
    relevantText.includes('ijazah') ||
    relevantText.includes('diploma') ||
    relevantText.includes('degree')
  ) {
    return 'IJAZAH';
  }

  return 'CUSTOM';
}

async function createAttributeCredentialId(
  baseCredentialId: string,
  label: string,
  value: string
): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${baseCredentialId}:${label}:${value}`
  );

  return `${baseCredentialId}#${digest.slice(0, 16)}`;
}

function normalizeRawCredentialContext(rawCredential: RawCredential): string[] {
  if (Array.isArray(rawCredential['@context'])) {
    const contexts = rawCredential['@context']
      .filter((item: unknown) => typeof item === 'string')
      .map((item: string) => item.trim())
      .filter(Boolean);

    if (contexts.length > 0) {
      return contexts;
    }
  }

  return [VC_V2_CONTEXT, VC_EXAMPLES_V2_CONTEXT];
}

async function buildAttributeCredentials(params: {
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

  const context = normalizeRawCredentialContext(rawCredential);

  for (const claim of claims) {
    const id = await createAttributeCredentialId(
      baseCredentialId,
      claim.label,
      claim.value
    );

    credentials.push({
      '@context': context,
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
      rawJwt: rawCredential.rawJwt,
      vcJwt: rawCredential.vcJwt,
      securedCredential: rawCredential.securedCredential,
      verificationStatus: 'pending_verification',
    });
  }

  return credentials;
}

async function normalizeCredential(
  rawCredential: RawCredential
): Promise<ParsedScannedCredential> {
  const issuer = getIssuerId(rawCredential.issuer);
  const subject = getSubjectId(rawCredential.credentialSubject);
  const credentialName = getCredentialName(rawCredential);
  const documentType = inferDocumentType(rawCredential);
  const documentName = rawCredential.documentName || credentialName;
  const documentId =
    rawCredential.documentId ||
    rawCredential.id ||
    `qr-document-${Date.now()}`;
  const baseCredentialId =
    rawCredential.id ||
    rawCredential.documentId ||
    `qr-credential-${Date.now()}`;
  const issuanceDate =
    rawCredential.issuanceDate ||
    rawCredential.validFrom ||
    new Date().toISOString();
  const expirationDate = rawCredential.expirationDate || rawCredential.validUntil;
  const mainClaims = getMainClaims(rawCredential.credentialSubject);

  const normalizedCredentials = await buildAttributeCredentials({
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
  });

  if (normalizedCredentials.length === 0) {
    throw new Error('Credential tidak memiliki data subject yang dapat disimpan');
  }

  return {
    rawCredential,
    normalizedCredential: normalizedCredentials[0],
    normalizedCredentials,
    preview: {
      credentialName,
      issuer,
      subject,
      issuanceDate,
      expirationDate,
      mainClaims,
    },
    verificationStatus: 'pending_verification',
    source: 'qr_scan',
    importedAt: new Date().toISOString(),
  };
}

async function parseCredentialOffer(value: any): Promise<RawCredential> {
  if (typeof value === 'string') {
    const trimmed = value.trim();

    validateQrPayloadSize(trimmed);

    if (isJwtCredentialString(trimmed)) {
      return normalizeJwtCredentialPayload(trimmed);
    }

    const json = tryParseJSON(trimmed);

    if (looksLikeVC(json)) {
      return {
        ...json,
        '@context': Array.isArray(json['@context'])
          ? json['@context']
          : [VC_V2_CONTEXT, VC_EXAMPLES_V2_CONTEXT],
      };
    }

    const decoded = tryDecodeBase64(trimmed);

    if (decoded) {
      return parseCredentialOffer(decoded);
    }

    if (isCredentialOfferUri(trimmed)) {
      const offer = extractCredentialOfferFromUri(trimmed);

      if (!offer) {
        throw new Error('QR credential offer tidak valid');
      }

      return parseCredentialOffer(offer);
    }

    if (isHttpUrl(trimmed)) {
      const fetched = await fetchJSONWithTimeout(trimmed);
      return parseCredentialOffer(fetched);
    }

    throw new Error('QR tidak berisi credential yang valid');
  }

  if (looksLikeVC(value)) {
    return {
      ...value,
      '@context': Array.isArray(value['@context'])
        ? value['@context']
        : [VC_V2_CONTEXT, VC_EXAMPLES_V2_CONTEXT],
    };
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const credential =
      value.credential ||
      value.verifiableCredential ||
      value.vc ||
      value.data ||
      value.payload;

    if (credential) {
      return parseCredentialOffer(credential);
    }

    const offerUri =
      value.credential_offer_uri ||
      value.credentialOfferUri ||
      value.offer_uri;

    if (typeof offerUri === 'string') {
      const fetched = await fetchJSONWithTimeout(offerUri);
      return parseCredentialOffer(fetched);
    }
  }

  throw new Error('Data QR tidak dikenali sebagai credential');
}

export async function parseScannedCredential(
  value: string
): Promise<ParsedScannedCredential> {
  const rawCredential = await parseCredentialOffer(value);

  const credentialId =
    rawCredential.id || rawCredential.documentId || rawCredential.jwt;

  if (credentialId && (await isCredentialAlreadySaved(String(credentialId)))) {
    throw new Error('Credential ini sudah tersimpan di wallet.');
  }

  return normalizeCredential(rawCredential);
}

export async function importScannedCredential(
  parsed: ParsedScannedCredential
): Promise<ParsedScannedCredential> {
  for (const credential of parsed.normalizedCredentials) {
    await importCredentialSecurely(credential);
  }

  return {
    ...parsed,
    verificationStatus: 'verified',
    importedAt: new Date().toISOString(),
  };
}

export async function parseAndImportScannedCredential(
  value: string
): Promise<ParsedScannedCredential> {
  const parsed = await parseScannedCredential(value);
  return importScannedCredential(parsed);
}