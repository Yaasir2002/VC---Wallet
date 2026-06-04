// File: src/Services/credentialV2Service.ts
import * as Crypto from 'expo-crypto';

import {
  CredentialIssuer,
  CredentialMetadata,
  CredentialStatus,
  CredentialSubject,
  DocumentType,
  KtpFormData,
  VerifiableCredentialV2,
  VerificationStatus,
} from '../types/vc';

export const VC_V2_CONTEXT = 'https://www.w3.org/ns/credentials/v2';
export const VC_V1_CONTEXT = 'https://www.w3.org/2018/credentials/v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function nowIso(): string {
  return new Date().toISOString();
}

function createUrnUuid(): string {
  const uuid =
    typeof Crypto.randomUUID === 'function'
      ? Crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `urn:uuid:${uuid}`;
}

function normalizeTypes(value: unknown, fallbackType: string): string[] {
  const types = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : typeof value === 'string' && value.trim()
      ? [value]
      : [];

  return Array.from(new Set(['VerifiableCredential', ...types, fallbackType]));
}

function normalizeIssuer(value: unknown): CredentialIssuer {
  if (typeof value === 'string' && value.trim()) {
    return { id: value };
  }

  if (isRecord(value) && typeof value.id === 'string' && value.id.trim()) {
    return {
      ...value,
      id: value.id,
      name: typeof value.name === 'string' ? value.name : undefined,
    };
  }

  return { id: '-' };
}

function normalizeStatus(value: unknown): CredentialStatus {
  if (isRecord(value)) {
    return {
      ...value,
      type: typeof value.type === 'string' ? value.type : 'CredentialStatus',
      status: typeof value.status === 'string' ? value.status : undefined,
    };
  }

  return {
    type: 'CredentialStatus',
    status: 'active',
  };
}

function getProofStatus(value: any): CredentialMetadata['proofStatus'] {
  const jwt = value?.jwt || value?.securedCredential || value?.proof?.jwt;

  if (typeof jwt === 'string' && jwt.split('.').length === 3) {
    return 'jwt_signed';
  }

  if (value?.proof) {
    return 'present';
  }

  return 'none';
}

function inferVerificationStatus(value: any): VerificationStatus {
  const metadataStatus = value?.metadata?.verificationStatus;
  const directStatus = value?.verificationStatus;

  if (typeof metadataStatus === 'string') return metadataStatus as VerificationStatus;
  if (typeof directStatus === 'string') return directStatus as VerificationStatus;

  if (value?.jwt || value?.securedCredential || value?.proof) {
    return 'signed_unverified';
  }

  return 'unsigned';
}

function extractDocumentType(value: unknown): DocumentType {
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

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const [, payload] = jwt.trim().split('.');

    if (!payload) return null;

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '='
    );

    const decoded =
      typeof atob === 'function'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('utf8');

    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function isVcV2Credential(value: unknown): value is VerifiableCredentialV2 {
  if (!isRecord(value)) return false;

  const context = value['@context'];

  return (
    Array.isArray(context) &&
    context.includes(VC_V2_CONTEXT) &&
    Array.isArray(value.type) &&
    value.type.includes('VerifiableCredential') &&
    typeof value.validFrom === 'string' &&
    isRecord(value.credentialSubject)
  );
}

export function getCredentialSubject(value: unknown): CredentialSubject {
  if (!isRecord(value)) return {};

  if (isRecord(value.credentialSubject)) {
    return value.credentialSubject as CredentialSubject;
  }

  return {};
}

export function getCredentialValidFrom(credential: any): string {
  return credential?.validFrom || credential?.issuanceDate || '-';
}

export function getCredentialValidUntil(credential: any): string | undefined {
  return credential?.validUntil || credential?.expirationDate;
}

export function getCredentialIssuer(credential: any): CredentialIssuer {
  return normalizeIssuer(credential?.issuer);
}

export function getCredentialIssuerText(credential: any): string {
  const issuer = getCredentialIssuer(credential);

  return issuer.name || issuer.id || 'Unknown Issuer';
}

export function getCredentialDisplayName(credential: any): string {
  if (!credential) return 'Credential';

  if (typeof credential.documentName === 'string' && credential.documentName.trim()) {
    return credential.documentName;
  }

  if (
    isRecord(credential.metadata) &&
    typeof credential.metadata.documentName === 'string' &&
    credential.metadata.documentName.trim()
  ) {
    return credential.metadata.documentName;
  }

  const subject = getCredentialSubject(credential);

  if (typeof subject.documentName === 'string' && subject.documentName.trim()) {
    return subject.documentName;
  }

  if (Array.isArray(credential.type)) {
    const found = credential.type.find(
      (item: unknown) => typeof item === 'string' && item !== 'VerifiableCredential'
    );

    if (typeof found === 'string') return found;
  }

  return 'Credential';
}

export function getCredentialStatus(credential: any): CredentialStatus {
  return normalizeStatus(credential?.credentialStatus);
}

export function hasCredentialSignature(credential: any): boolean {
  const jwt = credential?.jwt || credential?.securedCredential || credential?.proof?.jwt;

  return typeof jwt === 'string' && jwt.split('.').length === 3;
}

export type BuildVcV2CredentialInput = {
  id?: string;
  type?: string[];
  issuer: string | CredentialIssuer;
  validFrom?: string;
  validUntil?: string;
  credentialSubject: CredentialSubject;
  credentialStatus?: CredentialStatus;
  proof?: unknown;
  jwt?: string;
  securedCredential?: string;
  metadata?: Partial<CredentialMetadata>;
  documentId?: string;
  documentType?: DocumentType;
  documentName?: string;
  source?: CredentialMetadata['source'];
};

export function buildVcV2Credential(input: BuildVcV2CredentialInput): VerifiableCredentialV2 {
  const createdAt = input.metadata?.createdAt || nowIso();
  const updatedAt = nowIso();

  const documentId =
    input.documentId ||
    (typeof input.credentialSubject.documentId === 'string'
      ? input.credentialSubject.documentId
      : undefined) ||
    createUrnUuid();

  const documentType =
    input.documentType ||
    extractDocumentType(input.credentialSubject.documentType);

  const documentName =
    input.documentName ||
    (typeof input.credentialSubject.documentName === 'string'
      ? input.credentialSubject.documentName
      : undefined) ||
    'Credential Document';

  const subject: CredentialSubject = {
    ...input.credentialSubject,
    documentId,
    documentType,
    documentName,
  };

  const proofStatus =
    input.metadata?.proofStatus ||
    getProofStatus({
      jwt: input.jwt,
      securedCredential: input.securedCredential,
      proof: input.proof,
    });

  const verificationStatus =
    input.metadata?.verificationStatus ||
    (proofStatus === 'jwt_signed' ? 'signed_unverified' : 'unsigned');

  const credential: VerifiableCredentialV2 = {
    '@context': [VC_V2_CONTEXT],
    id: input.id || createUrnUuid(),
    type: normalizeTypes(input.type, `${documentType}Credential`),
    issuer: normalizeIssuer(input.issuer),
    validFrom: input.validFrom || nowIso(),
    credentialSubject: subject,
    credentialStatus:
      input.credentialStatus ||
      {
        type: 'CredentialStatus',
        status: 'active',
      },
    metadata: {
      schemaVersion: 'vc-data-model-v2.0',
      source: input.source || input.metadata?.source || 'wallet',
      verificationStatus,
      proofStatus,
      createdAt,
      updatedAt,
      originalFormat: input.metadata?.originalFormat || 'vc-v2',
      jwt: input.jwt || input.securedCredential || input.metadata?.jwt,
      securedCredential:
        input.securedCredential || input.jwt || input.metadata?.securedCredential,
      documentId,
      documentType,
      documentName,
      ...input.metadata,
    },
    documentId,
    documentType,
    documentName,
    verificationStatus,
  };

  if (input.validUntil) credential.validUntil = input.validUntil;
  if (input.proof) credential.proof = input.proof;
  if (input.jwt) credential.jwt = input.jwt;
  if (input.securedCredential) credential.securedCredential = input.securedCredential;

  return credential;
}

export function normalizeCredentialToV2(input: unknown): VerifiableCredentialV2 {
  return normalizeToVcV2(input);
}

export function normalizeToVcV2(input: unknown): VerifiableCredentialV2 {
  if (typeof input === 'string') {
    const trimmed = input.trim();

    if (trimmed.split('.').length === 3) {
      const payload = decodeJwtPayload(trimmed);
      const vc = isRecord(payload?.vc) ? payload.vc : {};

      const subject =
        isRecord(vc.credentialSubject)
          ? (vc.credentialSubject as CredentialSubject)
          : {
              id: typeof payload?.sub === 'string' ? payload.sub : undefined,
              importedJwt: '[JWT Credential]',
            };

      const validFrom =
        typeof vc.validFrom === 'string'
          ? vc.validFrom
          : typeof vc.issuanceDate === 'string'
            ? vc.issuanceDate
            : typeof payload?.nbf === 'number'
              ? new Date(payload.nbf * 1000).toISOString()
              : nowIso();

      const validUntil =
        typeof vc.validUntil === 'string'
          ? vc.validUntil
          : typeof vc.expirationDate === 'string'
            ? vc.expirationDate
            : typeof payload?.exp === 'number'
              ? new Date(payload.exp * 1000).toISOString()
              : undefined;

      return buildVcV2Credential({
        id: typeof payload?.jti === 'string' ? payload.jti : createUrnUuid(),
        type: Array.isArray(vc.type) ? (vc.type as string[]) : ['VerifiableCredential'],
        issuer:
          typeof vc.issuer === 'string' || isRecord(vc.issuer)
            ? (vc.issuer as any)
            : typeof payload?.iss === 'string'
              ? payload.iss
              : '-',
        validFrom,
        validUntil,
        credentialSubject: subject,
        jwt: trimmed,
        securedCredential: trimmed,
        proof: {
          type: 'JwtProof2020',
          jwt: trimmed,
          created: validFrom,
          proofPurpose: 'assertionMethod',
          verificationMethod: typeof payload?.iss === 'string' ? payload.iss : '-',
        },
        metadata: {
          schemaVersion: 'vc-data-model-v2.0',
          source: 'import',
          verificationStatus: 'signed_unverified',
          proofStatus: 'jwt_signed',
          createdAt: nowIso(),
          updatedAt: nowIso(),
          originalFormat: 'jwt-vc',
          jwt: trimmed,
          securedCredential: trimmed,
        },
      });
    }

    try {
      return normalizeToVcV2(JSON.parse(trimmed));
    } catch {
      return buildVcV2Credential({
        issuer: '-',
        credentialSubject: { importedRaw: trimmed },
        metadata: {
          schemaVersion: 'vc-data-model-v2.0',
          source: 'import',
          verificationStatus: 'unsupported_format',
          proofStatus: 'none',
          createdAt: nowIso(),
          updatedAt: nowIso(),
          originalFormat: 'unknown',
        },
      });
    }
  }

  if (!isRecord(input)) {
    return buildVcV2Credential({
      issuer: '-',
      credentialSubject: {},
      metadata: {
        schemaVersion: 'vc-data-model-v2.0',
        source: 'import',
        verificationStatus: 'unsupported_format',
        proofStatus: 'none',
        createdAt: nowIso(),
        updatedAt: nowIso(),
        originalFormat: 'unknown',
      },
    });
  }

  if (typeof input.jwt === 'string' && input.jwt.split('.').length === 3) {
    const jwtNormalized = normalizeToVcV2(input.jwt);

    return {
      ...jwtNormalized,
      ...normalizeToVcV2({
        ...input,
        jwt: undefined,
        securedCredential: undefined,
      }),
      jwt: input.jwt,
      securedCredential:
        typeof input.securedCredential === 'string' ? input.securedCredential : input.jwt,
      proof: input.proof || jwtNormalized.proof,
      metadata: {
        ...jwtNormalized.metadata,
        ...(isRecord(input.metadata) ? input.metadata : {}),
        jwt: input.jwt,
        securedCredential:
          typeof input.securedCredential === 'string' ? input.securedCredential : input.jwt,
      } as any,
    };
  }

  const subject = getCredentialSubject(input);

  const validFrom =
    typeof input.validFrom === 'string'
      ? input.validFrom
      : typeof input.issuanceDate === 'string'
        ? input.issuanceDate
        : nowIso();

  const validUntil =
    typeof input.validUntil === 'string'
      ? input.validUntil
      : typeof input.expirationDate === 'string'
        ? input.expirationDate
        : undefined;

  const documentType = extractDocumentType(input.documentType || subject.documentType);

  const normalized = buildVcV2Credential({
    id: typeof input.id === 'string' ? input.id : undefined,
    type: Array.isArray(input.type) ? (input.type as string[]) : undefined,
    issuer: normalizeIssuer(input.issuer),
    validFrom,
    validUntil,
    credentialSubject: subject,
    credentialStatus: normalizeStatus(input.credentialStatus),
    proof: input.proof,
    securedCredential:
      typeof input.securedCredential === 'string' ? input.securedCredential : undefined,
    documentId:
      typeof input.documentId === 'string'
        ? input.documentId
        : typeof subject.documentId === 'string'
          ? subject.documentId
          : undefined,
    documentType,
    documentName:
      typeof input.documentName === 'string'
        ? input.documentName
        : typeof subject.documentName === 'string'
          ? subject.documentName
          : getCredentialDisplayName(input),
    metadata: {
      schemaVersion: 'vc-data-model-v2.0',
      source:
        typeof input.source === 'string'
          ? (input.source as CredentialMetadata['source'])
          : isVcV2Credential(input)
            ? 'wallet'
            : 'legacy-migration',
      verificationStatus: inferVerificationStatus(input),
      proofStatus: getProofStatus(input),
      createdAt:
        isRecord(input.metadata) && typeof input.metadata.createdAt === 'string'
          ? input.metadata.createdAt
          : validFrom,
      updatedAt: nowIso(),
      originalFormat: isVcV2Credential(input) ? 'vc-v2' : 'vc-v1.1',
      ...(isRecord(input.metadata) ? input.metadata : {}),
    },
  });

  return {
    ...normalized,
    issuanceDate:
      typeof input.issuanceDate === 'string' ? input.issuanceDate : undefined,
    expirationDate:
      typeof input.expirationDate === 'string' ? input.expirationDate : undefined,
    verificationResult: input.verificationResult,
    verification: input.verification,
    verifiedAt:
      typeof input.verifiedAt === 'string' || input.verifiedAt === null
        ? input.verifiedAt
        : null,
    importedAt:
      typeof input.importedAt === 'string' ? input.importedAt : undefined,
    source: typeof input.source === 'string' ? input.source : undefined,
  };
}

export function buildKtpDigitalCredential(params: {
  formData: KtpFormData;
  holderDid: string;
  issuerName?: string;
  jwt?: string;
}): VerifiableCredentialV2 {
  const now = nowIso();
  const documentId = `KTP-${Date.now()}`;
  const normalized = normalizeKtpFormData(params.formData);

  const subject = {
    id: params.holderDid,
    documentId,
    documentType: 'KTP',
    documentName: 'KTP Digital',
    nama: normalized.nama,
    nik: normalized.nik,
    tempatLahir: normalized.tempatLahir,
    tanggalLahir: normalized.tanggalLahir,
    jenisKelamin: normalized.jenisKelamin,
    alamat: normalized.alamat,
    rtRw: normalized.rtRw,
    kelurahanDesa: normalized.kelurahanDesa,
    kecamatan: normalized.kecamatan,
    agama: normalized.agama,
    statusPerkawinan: normalized.statusPerkawinan,
    pekerjaan: normalized.pekerjaan,
    kewarganegaraan: normalized.kewarganegaraan,
    berlakuHingga: normalized.berlakuHingga,

    /**
     * Alias agar UI lama tetap membaca data.
     */
    fullName: normalized.nama,
    birthPlace: normalized.tempatLahir,
    birthDate: normalized.tanggalLahir,
    gender: normalized.jenisKelamin,
    address: normalized.alamat,
    religion: normalized.agama,
    maritalStatus: normalized.statusPerkawinan,
    occupation: normalized.pekerjaan,
    citizenship: normalized.kewarganegaraan,
    validUntilText: normalized.berlakuHingga,
  };

  return buildVcV2Credential({
    id: createUrnUuid(),
    type: ['VerifiableCredential', 'KTPDigitalCredential', 'IdentityCredential'],
    issuer: {
      id: params.holderDid,
      name: params.issuerName || 'Self Issued KTP Digital',
    },
    validFrom: now,
    credentialSubject: subject,
    credentialStatus: {
      type: 'KTPDigitalStatus',
      status: 'active',
    },
    documentId,
    documentType: 'KTP',
    documentName: 'KTP Digital',
    jwt: params.jwt,
    securedCredential: params.jwt,
    metadata: {
      schemaVersion: 'vc-data-model-v2.0',
      source: 'manual_ktp_form',
      verificationStatus: params.jwt ? 'self_signed' : 'unsigned',
      proofStatus: params.jwt ? 'jwt_signed' : 'none',
      createdAt: now,
      updatedAt: now,
      originalFormat: 'vc-v2',
      jwt: params.jwt,
      securedCredential: params.jwt,
      documentId,
      documentType: 'KTP',
      documentName: 'KTP Digital',
    },
  });
}

export function normalizeKtpFormData(input: Partial<KtpFormData>): KtpFormData {
  return {
    nama: input.nama?.trim() || '',
    nik: input.nik?.trim() || '',
    tempatLahir: input.tempatLahir?.trim() || '',
    tanggalLahir: input.tanggalLahir?.trim() || '',
    jenisKelamin: input.jenisKelamin?.trim() || '',
    alamat: input.alamat?.trim() || '',
    rtRw: input.rtRw?.trim() || '',
    kelurahanDesa: input.kelurahanDesa?.trim() || '',
    kecamatan: input.kecamatan?.trim() || '',
    agama: input.agama?.trim() || '',
    statusPerkawinan: input.statusPerkawinan?.trim() || '',
    pekerjaan: input.pekerjaan?.trim() || '',
    kewarganegaraan: input.kewarganegaraan?.trim() || 'WNI',
    berlakuHingga: input.berlakuHingga?.trim() || 'Seumur Hidup',
  };
}

export function validateKtpFormData(input: Partial<KtpFormData>): KtpFormData {
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

export function filterCredentialSubjectAttributes(
  credential: VerifiableCredentialV2,
  selectedAttributes?: string[]
): VerifiableCredentialV2 {
  if (!selectedAttributes || selectedAttributes.length === 0) {
    return credential;
  }

  const allowed = new Set([
    'id',
    'documentId',
    'documentType',
    'documentName',
    ...selectedAttributes,
  ]);

  const filteredSubject: CredentialSubject = {};

  for (const [key, value] of Object.entries(credential.credentialSubject || {})) {
    if (allowed.has(key)) {
      filteredSubject[key] = value;
    }
  }

  return {
    ...credential,
    credentialSubject: filteredSubject,
  };
}