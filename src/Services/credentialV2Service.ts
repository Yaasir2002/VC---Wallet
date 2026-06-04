// File: src/Services/credentialV2Service.ts

import * as Crypto from 'expo-crypto';

import {
  CredentialDocument,
  CredentialSubject,
  DocumentType,
  KtpCredentialInput,
  KtpFormData,
  VerifiableCredentialV2,
} from '../types/vc';

export const VC_V2_CONTEXT = 'https://www.w3.org/ns/credentials/v2';
export const VC_EXAMPLES_V2_CONTEXT =
  'https://www.w3.org/ns/credentials/examples/v2';

export const DEFAULT_ISSUER_DID = 'did:web:identitylab.id';

function nowIso(): string {
  return new Date().toISOString();
}

function createUuid(): string {
  if (typeof Crypto.randomUUID === 'function') {
    return Crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createCredentialId(): string {
  return `urn:uuid:${createUuid()}`;
}

export function createIssuanceDate(): string {
  return nowIso();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getStringFromRecord(
  record: Record<string, unknown>,
  keys: string[]
): string {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

export function normalizeKtpFormData(input: KtpCredentialInput): KtpFormData {
  const raw = input as Record<string, unknown>;

  return {
    nama: cleanString(input.nama || input.fullName),
    nik: cleanString(input.nik),
    tempatLahir: cleanString(input.tempatLahir || input.birthPlace),
    tanggalLahir: cleanString(input.tanggalLahir || input.birthDate),
    jenisKelamin: cleanString(input.jenisKelamin || input.gender),
    alamat: cleanString(input.alamat || input.address),
    rtRw: cleanString(input.rtRw),
    kelurahanDesa: cleanString(input.kelurahanDesa),
    kecamatan: cleanString(input.kecamatan),
    agama: cleanString(input.agama || input.religion),
    statusPerkawinan: cleanString(
      input.statusPerkawinan || input.maritalStatus
    ),
    pekerjaan: cleanString(input.pekerjaan || input.occupation),
    kewarganegaraan:
      cleanString(input.kewarganegaraan || input.citizenship) || 'WNI',
    berlakuHingga:
      cleanString(input.berlakuHingga || input.validUntil) || 'Seumur Hidup',
  };
}

export function validateKtpFormData(input: KtpCredentialInput): KtpFormData {
  const data = normalizeKtpFormData(input);

  if (!data.nama) throw new Error('Nama wajib diisi.');
  if (!data.nik) throw new Error('NIK wajib diisi.');

  if (!/^[0-9]{16}$/.test(data.nik)) {
    throw new Error('NIK harus berisi 16 digit angka.');
  }

  if (!data.tempatLahir) throw new Error('Tempat lahir wajib diisi.');
  if (!data.tanggalLahir) throw new Error('Tanggal lahir wajib diisi.');
  if (!data.jenisKelamin) throw new Error('Jenis kelamin wajib diisi.');
  if (!data.alamat) throw new Error('Alamat wajib diisi.');
  if (!data.agama) throw new Error('Agama wajib diisi.');
  if (!data.statusPerkawinan) {
    throw new Error('Status perkawinan wajib diisi.');
  }
  if (!data.pekerjaan) throw new Error('Pekerjaan wajib diisi.');
  if (!data.kewarganegaraan) throw new Error('Kewarganegaraan wajib diisi.');

  return data;
}

export function buildCredentialSubject(
  formData: KtpFormData,
  holderDid: string
): CredentialSubject {
  const subject: CredentialSubject = {
    id: holderDid,

    Nama: formData.nama,
    NIK: formData.nik,
    'Tempat Lahir': formData.tempatLahir,
    'Tanggal Lahir': formData.tanggalLahir,
    'Jenis Kelamin': formData.jenisKelamin,
    Alamat: formData.alamat,
    Agama: formData.agama,
    'Status Perkawinan': formData.statusPerkawinan,
    Pekerjaan: formData.pekerjaan,
    Kewarganegaraan: formData.kewarganegaraan,
    'Berlaku Hingga': formData.berlakuHingga,

    /**
     * Alias kompatibilitas UI lama dan helper lama.
     */
    nama: formData.nama,
    nik: formData.nik,
    tempatLahir: formData.tempatLahir,
    tanggalLahir: formData.tanggalLahir,
    jenisKelamin: formData.jenisKelamin,
    alamat: formData.alamat,
    agama: formData.agama,
    statusPerkawinan: formData.statusPerkawinan,
    pekerjaan: formData.pekerjaan,
    kewarganegaraan: formData.kewarganegaraan,
    berlakuHingga: formData.berlakuHingga,

    fullName: formData.nama,
    birthPlace: formData.tempatLahir,
    birthDate: formData.tanggalLahir,
    gender: formData.jenisKelamin,
    address: formData.alamat,
    religion: formData.agama,
    maritalStatus: formData.statusPerkawinan,
    occupation: formData.pekerjaan,
    citizenship: formData.kewarganegaraan,
    validUntilText: formData.berlakuHingga,
  };

  if (formData.rtRw) {
    subject['RT/RW'] = formData.rtRw;
    subject.rtRw = formData.rtRw;
  }

  if (formData.kelurahanDesa) {
    subject['Kelurahan/Desa'] = formData.kelurahanDesa;
    subject.kelurahanDesa = formData.kelurahanDesa;
  }

  if (formData.kecamatan) {
    subject.Kecamatan = formData.kecamatan;
    subject.kecamatan = formData.kecamatan;
  }

  return subject;
}

export function buildKtpCredential(
  formInput: KtpCredentialInput,
  holderDid: string
): VerifiableCredentialV2 {
  const formData = validateKtpFormData(formInput);
  const issuanceDate = createIssuanceDate();
  const id = createCredentialId();
  const documentId = `KTP-${Date.now()}`;

  return {
    '@context': [VC_V2_CONTEXT, VC_EXAMPLES_V2_CONTEXT],
    type: ['VerifiableCredential'],
    id,
    issuer: DEFAULT_ISSUER_DID,
    issuanceDate,
    credentialSubject: buildCredentialSubject(formData, holderDid),

    /**
     * Field internal aplikasi.
     */
    documentId,
    documentType: 'KTP',
    documentName: 'KTP Digital',
    verificationStatus: 'unsigned',
    metadata: {
      schemaVersion: 'vc-json-v2',
      source: 'manual_ktp_form',
      verificationStatus: 'unsigned',
      proofStatus: 'none',
      createdAt: issuanceDate,
      updatedAt: issuanceDate,
      documentId,
      documentType: 'KTP',
      documentName: 'KTP Digital',
    },
  };
}

function normalizeContext(value: unknown): string[] {
  const inputContexts = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : typeof value === 'string'
      ? [value]
      : [];

  const filtered = inputContexts.filter(
    (item) => !item.includes('2018/credentials/v1')
  );

  return Array.from(
    new Set([VC_V2_CONTEXT, VC_EXAMPLES_V2_CONTEXT, ...filtered])
  );
}

function normalizeType(value: unknown): string[] {
  const inputTypes = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : typeof value === 'string'
      ? [value]
      : [];

  const filtered = inputTypes.length > 0 ? inputTypes : ['VerifiableCredential'];

  return Array.from(new Set(['VerifiableCredential', ...filtered]));
}

function normalizeIssuer(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (isRecord(value) && typeof value.id === 'string' && value.id.trim()) {
    return value.id.trim();
  }

  return DEFAULT_ISSUER_DID;
}

function normalizeDocumentType(value: unknown): DocumentType {
  if (
    value === 'KTP' ||
    value === 'KTM' ||
    value === 'SIM' ||
    value === 'IJAZAH' ||
    value === 'CUSTOM'
  ) {
    return value;
  }

  return 'CUSTOM';
}

function normalizeCredentialSubjectFromLegacy(
  credential: Record<string, unknown>
): CredentialSubject {
  if (isRecord(credential.credentialSubject)) {
    return credential.credentialSubject as CredentialSubject;
  }

  const subject: CredentialSubject = {};

  const legacyAttributeName =
    typeof credential.attributeName === 'string'
      ? credential.attributeName
      : undefined;

  const legacyAttributeValue =
    typeof credential.attributeValue === 'string'
      ? credential.attributeValue
      : undefined;

  const legacyAttributeType =
    typeof credential.attributeType === 'string'
      ? credential.attributeType
      : undefined;

  if (legacyAttributeName && legacyAttributeValue) {
    subject[legacyAttributeName] = legacyAttributeValue;
  }

  if (legacyAttributeType && legacyAttributeValue) {
    subject[legacyAttributeType] = legacyAttributeValue;
  }

  return subject;
}

export function normalizeCredentialToV2(input: unknown): VerifiableCredentialV2 {
  if (!isRecord(input)) {
    throw new Error('Credential tidak valid.');
  }

  const credential = input as Record<string, unknown>;
  const subject = normalizeCredentialSubjectFromLegacy(credential);
  const metadata = isRecord(credential.metadata) ? credential.metadata : {};

  const id =
    typeof credential.id === 'string' && credential.id.trim()
      ? credential.id.trim()
      : createCredentialId();

  const issuanceDate =
    typeof credential.issuanceDate === 'string' && credential.issuanceDate.trim()
      ? credential.issuanceDate.trim()
      : typeof credential.validFrom === 'string' && credential.validFrom.trim()
        ? credential.validFrom.trim()
        : typeof credential.createdAt === 'string' && credential.createdAt.trim()
          ? credential.createdAt.trim()
          : createIssuanceDate();

  const issuer = normalizeIssuer(credential.issuer);

  const documentId =
    typeof credential.documentId === 'string' && credential.documentId.trim()
      ? credential.documentId.trim()
      : typeof metadata.documentId === 'string' && metadata.documentId.trim()
        ? metadata.documentId.trim()
        : typeof subject.documentId === 'string' && subject.documentId.trim()
          ? subject.documentId.trim()
          : id;

  const documentType = normalizeDocumentType(
    credential.documentType || metadata.documentType || subject.documentType
  );

  const documentName =
    typeof credential.documentName === 'string' && credential.documentName.trim()
      ? credential.documentName.trim()
      : typeof metadata.documentName === 'string' && metadata.documentName.trim()
        ? metadata.documentName.trim()
        : typeof subject.documentName === 'string' && subject.documentName.trim()
          ? subject.documentName.trim()
          : documentType === 'KTP'
            ? 'KTP Digital'
            : 'Credential Document';

  const verificationStatus =
    typeof credential.verificationStatus === 'string' &&
    credential.verificationStatus.trim()
      ? credential.verificationStatus.trim()
      : typeof metadata.verificationStatus === 'string' &&
          metadata.verificationStatus.trim()
        ? metadata.verificationStatus.trim()
        : 'unsigned';

  const proofStatus =
    typeof metadata.proofStatus === 'string' && metadata.proofStatus.trim()
      ? metadata.proofStatus.trim()
      : 'none';

  const createdAt =
    typeof metadata.createdAt === 'string' && metadata.createdAt.trim()
      ? metadata.createdAt.trim()
      : issuanceDate;

  const normalized: VerifiableCredentialV2 = {
    '@context': normalizeContext(credential['@context']),
    type: normalizeType(credential.type),
    id,
    issuer,
    issuanceDate,
    credentialSubject: subject,

    documentId,
    documentType,
    documentName,
    verificationStatus,
    metadata: {
      schemaVersion: 'vc-json-v2',
      source:
        typeof metadata.source === 'string' && metadata.source.trim()
          ? (metadata.source as any)
          : 'legacy-migration',
      verificationStatus: verificationStatus as any,
      proofStatus: proofStatus as any,
      createdAt,
      updatedAt: createIssuanceDate(),
      documentId,
      documentType,
      documentName,
    },

    jwt: typeof credential.jwt === 'string' ? credential.jwt : undefined,
    securedCredential:
      typeof credential.securedCredential === 'string'
        ? credential.securedCredential
        : undefined,
    proof: credential.proof,
    validFrom:
      typeof credential.validFrom === 'string' ? credential.validFrom : undefined,
    validUntil:
      typeof credential.validUntil === 'string'
        ? credential.validUntil
        : undefined,
    expirationDate:
      typeof credential.expirationDate === 'string'
        ? credential.expirationDate
        : undefined,
  };

  return normalized;
}

/**
 * Alias wajib untuk kompatibilitas file lama:
 * - src/Storage/secureCredentialStorage.ts
 * - file lain yang masih import normalizeToVcV2
 */
export function normalizeToVcV2(input: unknown): VerifiableCredentialV2 {
  return normalizeCredentialToV2(input);
}

export function isVcV2Credential(input: unknown): input is VerifiableCredentialV2 {
  if (!isRecord(input)) return false;

  return (
    Array.isArray(input['@context']) &&
    input['@context'].includes(VC_V2_CONTEXT) &&
    Array.isArray(input.type) &&
    input.type.includes('VerifiableCredential') &&
    typeof input.id === 'string' &&
    typeof input.issuer === 'string' &&
    typeof input.issuanceDate === 'string' &&
    isRecord(input.credentialSubject)
  );
}

export function getCredentialSubject(credential: unknown): CredentialSubject {
  if (!isRecord(credential)) return {};

  if (isRecord(credential.credentialSubject)) {
    return credential.credentialSubject as CredentialSubject;
  }

  return {};
}

export function getCredentialDisplayName(credential: unknown): string {
  if (!isRecord(credential)) return 'Credential';

  if (typeof credential.documentName === 'string' && credential.documentName.trim()) {
    return credential.documentName.trim();
  }

  if (isRecord(credential.metadata)) {
    const metadataName = credential.metadata.documentName;

    if (typeof metadataName === 'string' && metadataName.trim()) {
      return metadataName.trim();
    }
  }

  const subject = getCredentialSubject(credential);

  const nameFromSubject = getStringFromRecord(subject, [
    'documentName',
    'Nama',
    'nama',
    'fullName',
    'NIK',
    'nik',
  ]);

  return nameFromSubject || 'Credential';
}

export function hasCredentialSignature(credential: unknown): boolean {
  if (!isRecord(credential)) return false;

  const proof = isRecord(credential.proof) ? credential.proof : {};

  const candidates = [
    credential.jwt,
    credential.securedCredential,
    proof.jwt,
    proof.jws,
  ];

  return candidates.some(
    (candidate) =>
      typeof candidate === 'string' && candidate.trim().split('.').length === 3
  );
}

export function groupCredentialsByDocument(
  credentials: VerifiableCredentialV2[]
): CredentialDocument[] {
  const grouped: Record<string, CredentialDocument> = {};

  for (const credential of credentials) {
    const normalized = normalizeCredentialToV2(credential);

    const documentId =
      normalized.documentId || normalized.metadata?.documentId || normalized.id;

    const documentType =
      normalized.documentType || normalized.metadata?.documentType || 'CUSTOM';

    const documentName =
      normalized.documentName ||
      normalized.metadata?.documentName ||
      getCredentialDisplayName(normalized);

    if (!grouped[documentId]) {
      grouped[documentId] = {
        documentId,
        documentType,
        documentName,
        credentials: [],
      };
    }

    grouped[documentId].credentials.push(normalized);
  }

  return Object.values(grouped);
}