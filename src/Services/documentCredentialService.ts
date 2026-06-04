import { getDID } from '../Storage/didStorage';
import { saveVC, getAllVCs } from '../Storage/vcStorage';
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

function createDocumentId(documentType: DocumentType) {
  return `${documentType}-${Date.now()}`;
}

function createCredentialId(documentType: DocumentType) {
  return `${documentType}-VC-${Date.now()}`;
}

function getNowIso() {
  return new Date().toISOString();
}

function getExpirationDateFromValidUntil(validUntil?: string): string | undefined {
  const normalized = validUntil?.trim();

  if (!normalized) {
    return undefined;
  }

  if (normalized.toLowerCase() === 'seumur hidup') {
    return undefined;
  }

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

/**
 * Legacy helper.
 *
 * Fungsi ini masih dipertahankan untuk kompatibilitas jika ada screen lama/custom
 * yang masih memanggil createDocumentCredentials().
 *
 * Untuk revisi baru, credential seperti KTP/KTM/SIM/Ijazah sebaiknya dibuat
 * sebagai satu credential utuh, bukan banyak credential per atribut.
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

  const documentId = createDocumentId('KTP');
  const issuanceDate = getNowIso();
  const expirationDate = getExpirationDateFromValidUntil(input.validUntil);

  const credentialSubject = {
    id: didData.did,
    documentId,
    documentType: 'KTP',
    documentName: 'KTP Digital',
    fullName: input.fullName,
    nik: input.nik,
    birthPlace: input.birthPlace,
    birthDate: input.birthDate,
    gender: input.gender,
    address: input.address,
    religion: input.religion,
    maritalStatus: input.maritalStatus,
    occupation: input.occupation,
    citizenship: input.citizenship,
    validUntil: input.validUntil || 'Seumur Hidup',
  };

  const signed = await signVcJwtWithWallet({
    subjectDid: didData.did,
    documentId,
    documentType: 'KTP',
    documentName: 'KTP Digital',
    attributeType: 'ktpDocument' as AttributeType,
    attributeName: 'KTP Digital',
    attributeValue: JSON.stringify(credentialSubject),
    issuanceDate,
    expirationDate,
    credentialSubject,
  } as any);

  if (!isJwtString(signed.jwt)) {
    throw new Error('KTP Digital gagal dibuat sebagai VC JWT valid.');
  }

  const credential: ModularCredential = {
    id: createCredentialId('KTP'),
    documentId,
    documentType: 'KTP',
    documentName: 'KTP Digital',
    type: signed.type || ['VerifiableCredential', 'KTPCredential'],
    issuer: signed.issuerDid,
    issuanceDate,
    expirationDate,
    credentialSubject: credentialSubject as any,
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

  await saveVC(credential);

  return credential;
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