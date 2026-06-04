import { getDID } from '../Storage/didStorage';
import { saveVC, getAllVCs, getVCById } from '../Storage/vcStorage';
import {
  AttributeType,
  DocumentType,
  CredentialDocument,
  VerifiableCredentialV2,
} from '../types/vc';
import { buildVcV2Credential, getCredentialDisplayName } from './credentialV2Service';
import { signVcJwtWithWallet, isJwtString } from './walletJwtSigner';

type DocumentAttributeInput = {
  attributeType: AttributeType;
  attributeName: string;
  attributeValue: string;
  expirationDate?: string;
};

export type KtpCredentialInput = {
  fullName: string;
  nik: string;
  birthPlace: string;
  birthDate: string;
  gender: string;
  address: string;
  religion: string;
  maritalStatus: string;
  occupation: string;
  citizenship: string;
  validUntil?: string;
};

function createDocumentId(documentType: DocumentType) {
  return `${documentType}-${Date.now()}`;
}

function createCredentialId(documentType: DocumentType) {
  return `urn:uuid:${documentType}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function getNowIso() {
  return new Date().toISOString();
}

function normalizeKtpInput(input: KtpCredentialInput): KtpCredentialInput {
  return {
    fullName: input.fullName?.trim() ?? '',
    nik: input.nik?.trim() ?? '',
    birthPlace: input.birthPlace?.trim() ?? '',
    birthDate: input.birthDate?.trim() ?? '',
    gender: input.gender?.trim() ?? '',
    address: input.address?.trim() ?? '',
    religion: input.religion?.trim() ?? '',
    maritalStatus: input.maritalStatus?.trim() ?? '',
    occupation: input.occupation?.trim() ?? '',
    citizenship: input.citizenship?.trim() || 'WNI',
    validUntil: input.validUntil?.trim() || 'Seumur Hidup',
  };
}

function validateNormalizedKtpInput(input: KtpCredentialInput) {
  if (!input.fullName) throw new Error('Nama lengkap wajib diisi.');
  if (!/^[0-9]{16}$/.test(input.nik)) {
    throw new Error('NIK harus berisi 16 digit angka.');
  }
  if (!input.birthPlace) throw new Error('Tempat lahir wajib diisi.');
  if (!input.birthDate) throw new Error('Tanggal lahir wajib diisi.');
  if (!input.gender) throw new Error('Jenis kelamin wajib diisi.');
  if (!input.address) throw new Error('Alamat wajib diisi.');
  if (!input.religion) throw new Error('Agama wajib diisi.');
  if (!input.maritalStatus) throw new Error('Status perkawinan wajib diisi.');
  if (!input.occupation) throw new Error('Pekerjaan wajib diisi.');
  if (!input.citizenship) throw new Error('Kewarganegaraan wajib diisi.');
}

function getValidUntilIso(validUntil?: string): string | undefined {
  const normalized = validUntil?.trim();

  if (!normalized) return undefined;

  const lower = normalized.toLowerCase();

  if (
    lower === 'seumur hidup' ||
    lower === 'berlaku seumur hidup' ||
    lower === 'lifetime'
  ) {
    return undefined;
  }

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

/**
 * Legacy compatibility:
 * fungsi lama dipertahankan, tetapi sekarang menyimpan SATU VC v2.0 per dokumen.
 */
export async function createDocumentCredentials(params: {
  documentType: DocumentType;
  documentName: string;
  attributes: DocumentAttributeInput[];
}) {
  const didData = await getDID();

  if (!didData?.did) {
    throw new Error('DID belum dibuat.');
  }

  const documentId = createDocumentId(params.documentType);
  const validFrom = getNowIso();

  const credentialSubject: Record<string, unknown> = {
    id: didData.did,
    documentId,
    documentType: params.documentType,
    documentName: params.documentName,
  };

  for (const attribute of params.attributes) {
    const key = attribute.attributeType === 'custom'
      ? attribute.attributeName
      : attribute.attributeType;

    credentialSubject[key] = attribute.attributeValue;
  }

  const validUntil = params.attributes
    .map((item) => item.expirationDate)
    .filter(Boolean)[0];

  const signed = await signVcJwtWithWallet({
    subjectDid: didData.did,
    documentId,
    documentType: params.documentType,
    documentName: params.documentName,
    validFrom,
    validUntil,
    credentialSubject,
    additionalTypes: [`${params.documentType}Credential`],
  });

  const credential = buildVcV2Credential({
    id: createCredentialId(params.documentType),
    type: signed.type,
    issuer: signed.issuer,
    validFrom,
    validUntil,
    credentialSubject,
    jwt: signed.jwt,
    proof: {
      type: 'JwtProof2020',
      created: validFrom,
      proofPurpose: 'assertionMethod',
      verificationMethod: signed.issuerDid,
      jwt: signed.jwt,
    },
    documentId,
    documentType: params.documentType,
    documentName: params.documentName,
    metadata: {
      schemaVersion: 'vc-data-model-v2.0',
      source: 'manual',
      verificationStatus: 'signed_unverified',
      proofStatus: 'jwt',
      createdAt: validFrom,
      updatedAt: validFrom,
      originalFormat: 'vc-v2',
      jwt: signed.jwt,
    },
  });

  await saveVC(credential);

  return [credential];
}

export async function createKtpCredential(
  input: KtpCredentialInput
): Promise<VerifiableCredentialV2> {
  const didData = await getDID();

  if (!didData?.did) {
    throw new Error('DID belum dibuat.');
  }

  const normalized = normalizeKtpInput(input);
  validateNormalizedKtpInput(normalized);

  const documentId = createDocumentId('KTP');
  const credentialId = createCredentialId('KTP');
  const validFrom = getNowIso();
  const validUntil = getValidUntilIso(normalized.validUntil);

  const credentialSubject = {
    id: didData.did,
    documentId,
    documentType: 'KTP',
    documentName: 'KTP Digital',
    fullName: normalized.fullName,
    nik: normalized.nik,
    birthPlace: normalized.birthPlace,
    birthDate: normalized.birthDate,
    gender: normalized.gender,
    address: normalized.address,
    religion: normalized.religion,
    maritalStatus: normalized.maritalStatus,
    occupation: normalized.occupation,
    citizenship: normalized.citizenship,
    validUntilText: normalized.validUntil || 'Seumur Hidup',
  };

  const signed = await signVcJwtWithWallet({
    subjectDid: didData.did,
    documentId,
    documentType: 'KTP',
    documentName: 'KTP Digital',
    validFrom,
    validUntil,
    credentialSubject,
    additionalTypes: ['IdentityCredential', 'KTPCredential'],
  });

  if (!isJwtString(signed.jwt)) {
    throw new Error('KTP Digital gagal dibuat sebagai VC JWT valid.');
  }

  const credential = buildVcV2Credential({
    id: credentialId,
    type: signed.type || ['VerifiableCredential', 'KTPCredential'],
    issuer: signed.issuer,
    validFrom,
    validUntil,
    credentialSubject,
    jwt: signed.jwt,
    proof: {
      type: 'JwtProof2020',
      created: validFrom,
      proofPurpose: 'assertionMethod',
      verificationMethod: signed.issuerDid,
      jwt: signed.jwt,
    },
    documentId,
    documentType: 'KTP',
    documentName: 'KTP Digital',
    metadata: {
      schemaVersion: 'vc-data-model-v2.0',
      source: 'manual',
      verificationStatus: 'signed_unverified',
      proofStatus: 'jwt',
      createdAt: validFrom,
      updatedAt: validFrom,
      originalFormat: 'vc-v2',
      jwt: signed.jwt,
    },
  });

  await saveVC(credential);

  const savedCredential = await getVCById(credentialId);

  if (!savedCredential) {
    throw new Error('KTP Digital gagal disimpan ke wallet.');
  }

  return savedCredential;
}

export async function getCredentialDocuments(): Promise<CredentialDocument[]> {
  const credentials = await getAllVCs();
  const grouped: Record<string, CredentialDocument> = {};

  for (const vc of credentials) {
    const subject = vc.credentialSubject || {};

    const documentId =
      vc.documentId ||
      vc.metadata?.documentId ||
      (typeof subject.documentId === 'string' ? subject.documentId : undefined) ||
      vc.id;

    const documentType =
      vc.documentType ||
      vc.metadata?.documentType ||
      (subject.documentType as DocumentType) ||
      'CUSTOM';

    const documentName =
      vc.documentName ||
      vc.metadata?.documentName ||
      (typeof subject.documentName === 'string' ? subject.documentName : undefined) ||
      getCredentialDisplayName(vc);

    if (!grouped[documentId]) {
      grouped[documentId] = {
        documentId,
        documentType,
        documentName,
        credentials: [],
      };
    }

    grouped[documentId].credentials.push(vc);
  }

  return Object.values(grouped);
}

export async function getCredentialDocumentById(
  documentId: string
): Promise<CredentialDocument | null> {
  const documents = await getCredentialDocuments();

  return documents.find((doc) => doc.documentId === documentId) || null;
}