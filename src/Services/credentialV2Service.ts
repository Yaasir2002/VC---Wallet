import * as Crypto from 'expo-crypto';

import {
  CredentialIssuer,
  CredentialSubject,
  DocumentType,
  KtpFormData,
  VerifiableCredentialV2,
  VerificationStatus,
} from '../types/vc';

export const VC_V2_CONTEXT = 'https://www.w3.org/ns/credentials/v2';
export const VC_EXAMPLES_V2_CONTEXT = 'https://www.w3.org/ns/credentials/examples/v2';

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

export function normalizeKtpFormData(input: Partial<KtpFormData> & Record<string, unknown>): KtpFormData {
  return {
    nama: String(input.nama ?? input.fullName ?? '').trim(),
    nik: String(input.nik ?? input.NIK ?? '').trim(),
    tempatLahir: String(input.tempatLahir ?? input.birthPlace ?? '').trim(),
    tanggalLahir: String(input.tanggalLahir ?? input.birthDate ?? '').trim(),
    jenisKelamin: String(input.jenisKelamin ?? input.gender ?? '').trim(),
    alamat: String(input.alamat ?? input.address ?? '').trim(),
    rtRw: String(input.rtRw ?? input['RT/RW'] ?? '').trim(),
    kelurahanDesa: String(input.kelurahanDesa ?? input['Kelurahan/Desa'] ?? '').trim(),
    kecamatan: String(input.kecamatan ?? '').trim(),
    agama: String(input.agama ?? input.religion ?? '').trim(),
    statusPerkawinan: String(input.statusPerkawinan ?? input.maritalStatus ?? '').trim(),
    pekerjaan: String(input.pekerjaan ?? input.occupation ?? '').trim(),
    kewarganegaraan: String(input.kewarganegaraan ?? input.citizenship ?? 'WNI').trim(),
    berlakuHingga: String(input.berlakuHingga ?? input.validUntil ?? 'Seumur Hidup').trim(),
    nim: String(input.nim ?? input.Nim ?? input['Nim '] ?? '').trim() || undefined,
  };
}

export function validateKtpFormData(input: Partial<KtpFormData> & Record<string, unknown>): KtpFormData {
  const data = normalizeKtpFormData(input);

  if (!data.nama) throw new Error('Nama wajib diisi.');
  if (!data.nik) throw new Error('NIK wajib diisi.');
  if (!/^[0-9]{16}$/.test(data.nik)) throw new Error('NIK harus berisi 16 digit angka.');
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

export function buildCredentialSubject(formData: KtpFormData, holderDid: string): CredentialSubject {
  const subject: CredentialSubject = {
    id: holderDid,
    Nama: formData.nama,
    NIK: formData.nik,
    'Tempat Lahir': formData.tempatLahir,
    'Tanggal Lahir': formData.tanggalLahir,
    'Jenis Kelamin': formData.jenisKelamin,
    Alamat: formData.alamat,
    'RT/RW': formData.rtRw || '-',
    'Kelurahan/Desa': formData.kelurahanDesa || '-',
    Kecamatan: formData.kecamatan || '-',
    Agama: formData.agama,
    'Status Perkawinan': formData.statusPerkawinan,
    Pekerjaan: formData.pekerjaan,
    Kewarganegaraan: formData.kewarganegaraan,
    'Berlaku Hingga': formData.berlakuHingga,

    /**
     * Alias agar UI lama tetap bisa membaca.
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

  if (formData.nim) {
    subject['Nim '] = formData.nim;
    subject.Nim = formData.nim;
    subject.nim = formData.nim;
  }

  return subject;
}

export function getIssuerId(issuer: CredentialIssuer | undefined): string {
  if (!issuer) return '-';
  if (typeof issuer === 'string') return issuer;
  return issuer.id || '-';
}

export function getIssuerText(issuer: CredentialIssuer | undefined): string {
  if (!issuer) return 'Unknown Issuer';
  if (typeof issuer === 'string') return issuer;
  return issuer.name || issuer.id || 'Unknown Issuer';
}

export function buildKtpCredential(
  formDataInput: Partial<KtpFormData> & Record<string, unknown>,
  holderDid: string
): VerifiableCredentialV2 {
  const formData = validateKtpFormData(formDataInput);
  const issuanceDate = createIssuanceDate();
  const id = createCredentialId();

  return {
    '@context': [VC_V2_CONTEXT, VC_EXAMPLES_V2_CONTEXT],
    type: ['VerifiableCredential'],
    id,
    issuer: holderDid,
    issuanceDate,
    credentialSubject: buildCredentialSubject(formData, holderDid),

    documentId: id,
    documentType: 'KTP',
    documentName: 'KTP Digital',
    validFrom: issuanceDate,
    verificationStatus: 'self_signed',
    credentialStatus: {
      type: 'KTPDigitalStatus',
      status: 'active',
    },
    metadata: {
      schemaVersion: 'vc-data-model-v2.0',
      source: 'manual_ktp_form',
      verificationStatus: 'self_signed',
      proofStatus: 'none',
      createdAt: issuanceDate,
      updatedAt: issuanceDate,
      originalFormat: 'vc-json-v2',
    },
  };
}

export function isVcV2Credential(value: unknown): value is VerifiableCredentialV2 {
  if (!isRecord(value)) return false;

  const context = value['@context'];

  return (
    Array.isArray(context) &&
    context.includes(VC_V2_CONTEXT) &&
    Array.isArray(value.type) &&
    value.type.includes('VerifiableCredential') &&
    typeof value.id === 'string' &&
    typeof value.issuanceDate === 'string' &&
    isRecord(value.credentialSubject)
  );
}

export function normalizeToVcV2(input: unknown): VerifiableCredentialV2 {
  if (typeof input === 'string') {
    try {
      return normalizeToVcV2(JSON.parse(input));
    } catch {
      const now = createIssuanceDate();

      return {
        '@context': [VC_V2_CONTEXT, VC_EXAMPLES_V2_CONTEXT],
        type: ['VerifiableCredential'],
        id: createCredentialId(),
        issuer: '-',
        issuanceDate: now,
        credentialSubject: {
          id: '-',
          raw: input,
        },
        documentId: createCredentialId(),
        documentType: 'CUSTOM',
        documentName: 'Imported Credential',
        verificationStatus: 'unsupported_format',
        metadata: {
          schemaVersion: 'vc-data-model-v2.0',
          source: 'import',
          verificationStatus: 'unsupported_format',
          proofStatus: 'none',
          createdAt: now,
          updatedAt: now,
          originalFormat: 'unknown',
        },
      };
    }
  }

  if (!isRecord(input)) {
    const now = createIssuanceDate();

    return {
      '@context': [VC_V2_CONTEXT, VC_EXAMPLES_V2_CONTEXT],
      type: ['VerifiableCredential'],
      id: createCredentialId(),
      issuer: '-',
      issuanceDate: now,
      credentialSubject: { id: '-' },
      documentId: createCredentialId(),
      documentType: 'CUSTOM',
      documentName: 'Credential',
      verificationStatus: 'unsupported_format',
      metadata: {
        schemaVersion: 'vc-data-model-v2.0',
        source: 'import',
        verificationStatus: 'unsupported_format',
        proofStatus: 'none',
        createdAt: now,
        updatedAt: now,
        originalFormat: 'unknown',
      },
    };
  }

  if (isVcV2Credential(input)) {
    return input;
  }

  const now = createIssuanceDate();
  const subject = isRecord(input.credentialSubject)
    ? input.credentialSubject
    : {
        id: typeof input.subjectDid === 'string' ? input.subjectDid : '-',
      };

  const issuanceDate =
    typeof input.issuanceDate === 'string'
      ? input.issuanceDate
      : typeof input.validFrom === 'string'
        ? input.validFrom
        : now;

  const id = typeof input.id === 'string' ? input.id : createCredentialId();

  const issuer =
    typeof input.issuer === 'string' || isRecord(input.issuer)
      ? (input.issuer as CredentialIssuer)
      : '-';

  const type = Array.isArray(input.type)
    ? input.type.filter((item): item is string => typeof item === 'string')
    : ['VerifiableCredential'];

  const documentType = (
    input.documentType === 'KTP' ||
    input.documentType === 'KTM' ||
    input.documentType === 'SIM' ||
    input.documentType === 'IJAZAH'
      ? input.documentType
      : 'CUSTOM'
  ) as DocumentType;

  return {
    '@context': [VC_V2_CONTEXT, VC_EXAMPLES_V2_CONTEXT],
    type: type.includes('VerifiableCredential') ? type : ['VerifiableCredential', ...type],
    id,
    issuer,
    issuanceDate,
    credentialSubject: subject,
    documentId:
      typeof input.documentId === 'string'
        ? input.documentId
        : typeof subject.documentId === 'string'
          ? subject.documentId
          : id,
    documentType,
    documentName:
      typeof input.documentName === 'string'
        ? input.documentName
        : typeof subject.documentName === 'string'
          ? subject.documentName
          : documentType === 'KTP'
            ? 'KTP Digital'
            : 'Credential',
    validFrom: issuanceDate,
    validUntil:
      typeof input.validUntil === 'string'
        ? input.validUntil
        : typeof input.expirationDate === 'string'
          ? input.expirationDate
          : undefined,
    expirationDate:
      typeof input.expirationDate === 'string' ? input.expirationDate : undefined,
    jwt: typeof input.jwt === 'string' ? input.jwt : undefined,
    securedCredential:
      typeof input.securedCredential === 'string' ? input.securedCredential : undefined,
    proof: input.proof,
    verificationStatus:
      typeof input.verificationStatus === 'string'
        ? input.verificationStatus
        : 'signed_unverified',
    metadata: {
      schemaVersion: 'vc-data-model-v2.0',
      source: 'legacy-migration',
      verificationStatus:
        typeof input.verificationStatus === 'string'
          ? (input.verificationStatus as VerificationStatus)
          : 'signed_unverified',
      proofStatus:
        typeof input.jwt === 'string' || typeof input.securedCredential === 'string'
          ? 'jwt_signed'
          : 'none',
      createdAt: issuanceDate,
      updatedAt: now,
      originalFormat: 'legacy',
      ...(isRecord(input.metadata) ? input.metadata : {}),
    },
  };
}

export function getCredentialSubject(credential: unknown): CredentialSubject {
  if (!isRecord(credential)) return {};
  if (!isRecord(credential.credentialSubject)) return {};
  return credential.credentialSubject as CredentialSubject;
}

export function getCredentialDisplayName(credential: VerifiableCredentialV2): string {
  return (
    credential.documentName ||
    (typeof credential.credentialSubject?.documentName === 'string'
      ? credential.credentialSubject.documentName
      : '') ||
    (credential.documentType === 'KTP' ? 'KTP Digital' : 'Credential')
  );
}