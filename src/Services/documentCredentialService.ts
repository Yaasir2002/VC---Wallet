import { getDID } from '../Storage/didStorage';
import { saveVC, getAllVCs, getVCById } from '../Storage/vcStorage';
import {
  AttributeType,
  DocumentType,
  CredentialDocument,
  ModularCredential,
} from '../types/vc';
import { createAttributeCredential } from './credentialService';
import { isJwtString, signVcJwtWithWallet } from './walletJwtSigner';

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

type KtpCredentialSubject = {
  id: string;
  documentId: string;
  documentType: 'KTP';
  documentName: 'KTP Digital';
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
  validUntil: string;
};

function createDocumentId(documentType: DocumentType) {
  return `${documentType}-${Date.now()}`;
}

function createCredentialId(documentType: DocumentType) {
  return `${documentType}-VC-${Date.now()}-${Math.random()
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

function getExpirationDateFromValidUntil(validUntil?: string): string | undefined {
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

function isKtpCredentialSubject(value: unknown): value is KtpCredentialSubject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const subject = value as Record<string, unknown>;

  return (
    subject.documentType === 'KTP' &&
    typeof subject.fullName === 'string' &&
    subject.fullName.trim().length > 0 &&
    typeof subject.nik === 'string' &&
    subject.nik.trim().length > 0 &&
    typeof subject.birthPlace === 'string' &&
    subject.birthPlace.trim().length > 0 &&
    typeof subject.birthDate === 'string' &&
    subject.birthDate.trim().length > 0 &&
    typeof subject.gender === 'string' &&
    subject.gender.trim().length > 0 &&
    typeof subject.address === 'string' &&
    subject.address.trim().length > 0 &&
    typeof subject.religion === 'string' &&
    subject.religion.trim().length > 0 &&
    typeof subject.maritalStatus === 'string' &&
    subject.maritalStatus.trim().length > 0 &&
    typeof subject.occupation === 'string' &&
    subject.occupation.trim().length > 0 &&
    typeof subject.citizenship === 'string' &&
    subject.citizenship.trim().length > 0 &&
    typeof subject.validUntil === 'string' &&
    subject.validUntil.trim().length > 0
  );
}

/**
 * Legacy helper.
 * Dipertahankan agar fitur lama/custom tidak langsung rusak.
 * Untuk KTP baru, jangan gunakan fungsi ini.
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

  if (!didData.did.startsWith('did:key:')) {
    throw new Error('DID harus did:key agar bisa signing dan verify offline.');
  }

  const documentId = createDocumentId(params.documentType);
  const createdCredentials: ModularCredential[] = [];

  for (const attribute of params.attributes) {
    const vc = await createAttributeCredential({
      subjectDid: didData.did,
      documentId,
      documentType: params.documentType,
      documentName: params.documentName,
      attributeType: attribute.attributeType,
      attributeName: attribute.attributeName,
      attributeValue: attribute.attributeValue,
      expirationDate: attribute.expirationDate,
    });

    if (!isJwtString(vc.jwt) && !isJwtString(vc.proof?.jwt)) {
      throw new Error(
        `Credential ${attribute.attributeName} gagal dibuat sebagai VC JWT valid.`
      );
    }

    await saveVC(vc);
    createdCredentials.push(vc);
  }

  return createdCredentials;
}

export async function createKtpCredential(
  input: KtpCredentialInput
): Promise<ModularCredential> {
  const didData = await getDID();

  if (!didData?.did) {
    throw new Error('DID belum dibuat.');
  }

  if (!didData.did.startsWith('did:key:')) {
    throw new Error('DID harus did:key agar bisa signing dan verify offline.');
  }

  const normalized = normalizeKtpInput(input);

  validateNormalizedKtpInput(normalized);

  const documentId = createDocumentId('KTP');
  const credentialId = createCredentialId('KTP');
  const issuanceDate = getNowIso();
  const expirationDate = getExpirationDateFromValidUntil(normalized.validUntil);

  const credentialSubject: KtpCredentialSubject = {
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
    validUntil: normalized.validUntil || 'Seumur Hidup',
  };

  if (!isKtpCredentialSubject(credentialSubject)) {
    throw new Error('Data KTP tidak lengkap. Periksa kembali form KTP.');
  }

  const signed = await signVcJwtWithWallet({
    subjectDid: didData.did,
    documentId,
    documentType: 'KTP',
    documentName: 'KTP Digital',
    issuanceDate,
    expirationDate,
    credentialSubject,
    additionalTypes: ['IdentityCredential'],
  });

  if (!isJwtString(signed.jwt)) {
    throw new Error('KTP Digital gagal dibuat sebagai VC JWT valid.');
  }

  if (!isKtpCredentialSubject(signed.credentialSubject)) {
    throw new Error(
      'Signer tidak mengembalikan credentialSubject KTP utuh. Periksa walletJwtSigner.ts.'
    );
  }

  const credential: ModularCredential = {
    id: credentialId,
    documentId,
    documentType: 'KTP',
    documentName: 'KTP Digital',
    type: signed.type || ['VerifiableCredential', 'KTPCredential'],
    issuer: signed.issuerDid,
    issuanceDate,
    expirationDate,
    credentialSubject: signed.credentialSubject as any,
    jwt: signed.jwt,
    proof: {
      type: 'JwtProof2020',
      created: issuanceDate,
      proofPurpose: 'assertionMethod',
      verificationMethod: signed.issuerDid,
      jwt: signed.jwt,
    },
    verificationStatus: 'verified',
  };

  if (!isKtpCredentialSubject(credential.credentialSubject)) {
    throw new Error('Credential KTP gagal dibentuk sebagai satu credential utuh.');
  }

  await saveVC(credential);

  const savedCredential = await getVCById(credentialId);

  if (!savedCredential) {
    throw new Error('KTP Digital gagal disimpan ke wallet.');
  }

  if (!isKtpCredentialSubject(savedCredential.credentialSubject)) {
    throw new Error(
      'KTP tersimpan, tetapi credentialSubject tidak lengkap. Periksa fungsi saveVC/getVCById di vcStorage.ts.'
    );
  }

  if (!isJwtString(savedCredential.jwt) && !isJwtString(savedCredential.proof?.jwt)) {
    throw new Error(
      'KTP tersimpan, tetapi VC JWT hilang. Periksa fungsi saveVC/getVCById di vcStorage.ts.'
    );
  }

  return savedCredential;
}

export async function getCredentialDocuments(): Promise<CredentialDocument[]> {
  const credentials = await getAllVCs();
  const grouped: Record<string, CredentialDocument> = {};

  for (const vc of credentials) {
    const documentId = vc.documentId || `LEGACY-${vc.id}`;
    const documentType = vc.documentType || 'CUSTOM';
    const documentName =
      vc.documentName || getDefaultDocumentName(documentType);

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

function getDefaultDocumentName(documentType: DocumentType) {
  if (documentType === 'KTP') return 'KTP Digital';
  if (documentType === 'KTM') return 'KTM Digital';
  if (documentType === 'SIM') return 'SIM Digital';
  if (documentType === 'IJAZAH') return 'Ijazah Digital';

  return 'Credential Document';
}