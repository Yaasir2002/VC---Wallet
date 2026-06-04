// File: src/Services/documentCredentialService.ts
import { getAllVCs, getVCById } from '../Storage/vcStorage';
import {
  AttributeType,
  CredentialDocument,
  DocumentType,
  KtpFormData,
  VerifiableCredentialV2,
} from '../types/vc';
import {
  buildVcV2Credential,
  getCredentialDisplayName,
  normalizeToVcV2,
} from './credentialV2Service';
import { signAndSaveKtpCredential } from './credentialSigningService';
import { getHolderDid } from './walletSigner';
import { signVcJwtWithWallet } from './walletJwtSigner';
import { saveVC } from '../Storage/vcStorage';

type DocumentAttributeInput = {
  attributeType: AttributeType;
  attributeName: string;
  attributeValue: string;
  expirationDate?: string;
};

export type KtpCredentialInput = {
  nama?: string;
  nik: string;
  tempatLahir?: string;
  tanggalLahir?: string;
  jenisKelamin?: string;
  alamat: string;
  rtRw?: string;
  kelurahanDesa?: string;
  kecamatan?: string;
  agama: string;
  statusPerkawinan?: string;
  pekerjaan: string;
  kewarganegaraan?: string;
  berlakuHingga?: string;

  /**
   * Kompatibilitas form lama.
   */
  fullName?: string;
  birthPlace?: string;
  birthDate?: string;
  gender?: string;
  religion?: string;
  maritalStatus?: string;
  occupation?: string;
  citizenship?: string;
  validUntil?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function createDocumentId(documentType: DocumentType): string {
  return `${documentType}-${Date.now()}`;
}

function mapKtpInput(input: KtpCredentialInput): KtpFormData {
  return {
    nama: input.nama ?? input.fullName ?? '',
    nik: input.nik ?? '',
    tempatLahir: input.tempatLahir ?? input.birthPlace ?? '',
    tanggalLahir: input.tanggalLahir ?? input.birthDate ?? '',
    jenisKelamin: input.jenisKelamin ?? input.gender ?? '',
    alamat: input.alamat ?? '',
    rtRw: input.rtRw ?? '',
    kelurahanDesa: input.kelurahanDesa ?? '',
    kecamatan: input.kecamatan ?? '',
    agama: input.agama ?? input.religion ?? '',
    statusPerkawinan: input.statusPerkawinan ?? input.maritalStatus ?? '',
    pekerjaan: input.pekerjaan ?? input.occupation ?? '',
    kewarganegaraan: input.kewarganegaraan ?? input.citizenship ?? 'WNI',
    berlakuHingga: input.berlakuHingga ?? input.validUntil ?? 'Seumur Hidup',
  };
}

/**
 * Legacy compatibility:
 * fungsi lama tetap ada, tetapi sekarang menyimpan SATU credential utuh.
 */
export async function createDocumentCredentials(params: {
  documentType: DocumentType;
  documentName: string;
  attributes: DocumentAttributeInput[];
}): Promise<VerifiableCredentialV2[]> {
  const holderDid = await getHolderDid();
  const documentId = createDocumentId(params.documentType);
  const validFrom = nowIso();

  const credentialSubject: Record<string, unknown> = {
    id: holderDid,
    documentId,
    documentType: params.documentType,
    documentName: params.documentName,
  };

  for (const attribute of params.attributes) {
    const key =
      attribute.attributeType === 'custom'
        ? attribute.attributeName
        : attribute.attributeType;

    if (key && attribute.attributeValue?.trim()) {
      credentialSubject[key] = attribute.attributeValue.trim();
    }
  }

  const validUntil = params.attributes
    .map((item) => item.expirationDate)
    .find(Boolean);

  const signed = await signVcJwtWithWallet({
    subjectDid: holderDid,
    documentId,
    documentType: params.documentType,
    documentName: params.documentName,
    validFrom,
    validUntil,
    credentialSubject,
    additionalTypes: [`${params.documentType}Credential`],
  });

  const credential = buildVcV2Credential({
    type: signed.type,
    issuer: signed.issuer,
    validFrom,
    validUntil,
    credentialSubject,
    jwt: signed.jwt,
    securedCredential: signed.jwt,
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
      verificationStatus: 'self_signed',
      proofStatus: 'jwt_signed',
      createdAt: validFrom,
      updatedAt: validFrom,
      originalFormat: 'vc-v2',
      jwt: signed.jwt,
      securedCredential: signed.jwt,
      documentId,
      documentType: params.documentType,
      documentName: params.documentName,
    },
  });

  await saveVC(credential);

  return [credential];
}

export async function createKtpCredential(
  input: KtpCredentialInput
): Promise<VerifiableCredentialV2> {
  return signAndSaveKtpCredential(mapKtpInput(input));
}

export async function getCredentialDocuments(): Promise<CredentialDocument[]> {
  const rawCredentials = await getAllVCs();
  const grouped: Record<string, CredentialDocument> = {};

  for (const raw of rawCredentials) {
    const vc = normalizeToVcV2(raw);
    const subject = vc.credentialSubject || {};

    const documentId =
      vc.documentId ||
      vc.metadata?.documentId ||
      (typeof subject.documentId === 'string' ? subject.documentId : undefined) ||
      vc.id;

    const documentType =
      vc.documentType ||
      vc.metadata?.documentType ||
      ((subject.documentType as DocumentType) || 'CUSTOM');

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

export async function getCredentialByIdV2(
  credentialId: string
): Promise<VerifiableCredentialV2 | null> {
  const credential = await getVCById(credentialId);

  return credential ? normalizeToVcV2(credential) : null;
}