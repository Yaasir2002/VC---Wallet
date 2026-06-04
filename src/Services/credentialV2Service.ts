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

export function normalizeKtpFormData(input: KtpCredentialInput): KtpFormData {
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
    statusPerkawinan: cleanString(input.statusPerkawinan || input.maritalStatus),
    pekerjaan: cleanString(input.pekerjaan || input.occupation),
    kewarganegaraan: cleanString(input.kewarganegaraan || input.citizenship) || 'WNI',
    berlakuHingga: cleanString(input.berlakuHingga || input.validUntil) || 'Seumur Hidup',
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
  if (!data.statusPerkawinan) throw new Error('Status perkawinan wajib diisi.');
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
     * Alias kompatibilitas UI lama.
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

export function normalizeCredentialToV2(input: unknown): VerifiableCredentialV2 {
  if (!isRecord(input)) {
    throw new Error('Credential tidak valid.');
  }

  const credential = input as Record<string, unknown>;
  const subject = isRecord(credential.credentialSubject)
    ? credential.credentialSubject
    : {};

  const id =
    typeof credential.id === 'string' && credential.id.trim()
      ? credential.id
      : createCredentialId();

  const issuanceDate =
    typeof credential.issuanceDate === 'string' && credential.issuanceDate.trim()
      ? credential.issuanceDate
      : typeof credential.validFrom === 'string' && credential.validFrom.trim()
        ? credential.validFrom
        : createIssuanceDate();

  const issuer =
    typeof credential.issuer === 'string' && credential.issuer.trim()
      ? credential.issuer
      : isRecord(credential.issuer) && typeof credential.issuer.id === 'string'
        ? credential.issuer.id
        : DEFAULT_ISSUER_DID;

  const context = Array.isArray(credential['@context'])
    ? credential['@context'].filter((item): item is string => typeof item === 'string')
    : [];

  const normalizedContext = Array.from(
    new Set([VC_V2_CONTEXT, VC_EXAMPLES_V2_CONTEXT, ...context.filter((item) => !item.includes('2018/credentials/v1'))])
  );

  const type = Array.isArray(credential.type)
    ? credential.type.filter((item): item is string => typeof item === 'string')
    : ['VerifiableCredential'];

  const metadata = isRecord(credential.metadata)
    ? credential.metadata
    : {};

  const documentId =
    typeof credential.documentId === 'string'
      ? credential.documentId
      : typeof metadata.documentId === 'string'
        ? metadata.documentId
        : typeof subject.documentId === 'string'
          ? subject.documentId
          : id;

  const documentType =
    credential.documentType === 'KTP' ||
    credential.documentType === 'KTM' ||
    credential.documentType === 'SIM' ||
    credential.documentType === 'IJAZAH' ||
    credential.documentType === 'CUSTOM'
      ? credential.documentType
      : 'CUSTOM';

  const documentName =
    typeof credential.documentName === 'string'
      ? credential.documentName
      : typeof metadata.documentName === 'string'
        ? metadata.documentName
        : 'Credential Document';

  return {
    '@context': normalizedContext,
    type: type.length > 0 ? type : ['VerifiableCredential'],
    id,
    issuer,
    issuanceDate,
    credentialSubject: subject,
    documentId,
    documentType: documentType as DocumentType,
    documentName,
    verificationStatus:
      typeof credential.verificationStatus === 'string'
        ? credential.verificationStatus
        : typeof metadata.verificationStatus === 'string'
          ? metadata.verificationStatus
          : 'unsigned',
    jwt: typeof credential.jwt === 'string' ? credential.jwt : undefined,
    securedCredential:
      typeof credential.securedCredential === 'string'
        ? credential.securedCredential
        : undefined,
    proof: credential.proof,
    metadata: {
      schemaVersion: 'vc-json-v2',
      source: typeof metadata.source === 'string' ? metadata.source : 'legacy-migration',
      verificationStatus:
        typeof metadata.verificationStatus === 'string'
          ? (metadata.verificationStatus as any)
          : 'unsigned',
      proofStatus:
        typeof metadata.proofStatus === 'string'
          ? (metadata.proofStatus as any)
          : 'none',
      createdAt:
        typeof metadata.createdAt === 'string' ? metadata.createdAt : issuanceDate,
      updatedAt: createIssuanceDate(),
      documentId,
      documentType: documentType as DocumentType,
      documentName,
    },
  };
}

export function getCredentialSubject(credential: unknown): CredentialSubject {
  if (!isRecord(credential)) return {};

  return isRecord(credential.credentialSubject)
    ? credential.credentialSubject
    : {};
}

export function getCredentialDisplayName(credential: VerifiableCredentialV2): string {
  return credential.documentName || credential.metadata?.documentName || 'Credential';
}

export function hasCredentialSignature(credential: VerifiableCredentialV2): boolean {
  const jwt =
    credential.jwt ||
    credential.securedCredential ||
    (isRecord(credential.proof) && typeof credential.proof.jwt === 'string'
      ? credential.proof.jwt
      : '');

  return typeof jwt === 'string' && jwt.split('.').length === 3;
}

export function groupCredentialsByDocument(
  credentials: VerifiableCredentialV2[]
): CredentialDocument[] {
  const grouped: Record<string, CredentialDocument> = {};

  for (const credential of credentials) {
    const documentId = credential.documentId || credential.metadata?.documentId || credential.id;
    const documentType = credential.documentType || credential.metadata?.documentType || 'CUSTOM';
    const documentName =
      credential.documentName ||
      credential.metadata?.documentName ||
      getCredentialDisplayName(credential);

    if (!grouped[documentId]) {
      grouped[documentId] = {
        documentId,
        documentType,
        documentName,
        credentials: [],
      };
    }

    grouped[documentId].credentials.push(credential);
  }

  return Object.values(grouped);
}