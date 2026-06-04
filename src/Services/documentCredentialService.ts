import { getAllVCs, getVCById, saveVC } from '../Storage/vcStorage';
import {
  AttributeType,
  CredentialDocument,
  DocumentType,
  KtpFormData,
  VerifiableCredentialV2,
} from '../types/vc';
import {
  buildKtpCredential,
  getCredentialDisplayName,
  normalizeToVcV2,
} from './credentialV2Service';
import { getHolderDid } from './walletSigner';

type DocumentAttributeInput = {
  attributeType: AttributeType;
  attributeName: string;
  attributeValue: string;
  expirationDate?: string;
};

export type KtpCredentialInput = Partial<KtpFormData> & {
  fullName?: string;
  birthPlace?: string;
  birthDate?: string;
  gender?: string;
  address?: string;
  religion?: string;
  maritalStatus?: string;
  occupation?: string;
  citizenship?: string;
  validUntil?: string;
};

export async function createKtpCredential(
  input: KtpCredentialInput
): Promise<VerifiableCredentialV2> {
  const holderDid = await getHolderDid();
  const credential = buildKtpCredential(input, holderDid);

  await saveVC(credential);

  return credential;
}

export async function createDocumentCredentials(params: {
  documentType: DocumentType;
  documentName: string;
  attributes: DocumentAttributeInput[];
}): Promise<VerifiableCredentialV2[]> {
  const holderDid = await getHolderDid();
  const now = new Date().toISOString();
  const subject: Record<string, unknown> = {
    id: holderDid,
  };

  for (const attribute of params.attributes) {
    const key =
      attribute.attributeType === 'custom'
        ? attribute.attributeName
        : attribute.attributeType;

    if (key && attribute.attributeValue?.trim()) {
      subject[key] = attribute.attributeValue.trim();
    }
  }

  const credential: VerifiableCredentialV2 = {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://www.w3.org/ns/credentials/examples/v2',
    ],
    type: ['VerifiableCredential'],
    id: `urn:uuid:${Date.now()}-${Math.random().toString(36).slice(2)}`,
    issuer: holderDid,
    issuanceDate: now,
    credentialSubject: subject,
    documentId: `CUSTOM-${Date.now()}`,
    documentType: params.documentType,
    documentName: params.documentName,
    validFrom: now,
    verificationStatus: 'self_signed',
    metadata: {
      schemaVersion: 'vc-data-model-v2.0',
      source: 'manual',
      verificationStatus: 'self_signed',
      proofStatus: 'none',
      createdAt: now,
      updatedAt: now,
      originalFormat: 'vc-json-v2',
    },
  };

  await saveVC(credential);

  return [credential];
}

export async function getCredentialDocuments(): Promise<CredentialDocument[]> {
  const credentials = await getAllVCs();
  const grouped: Record<string, CredentialDocument> = {};

  for (const item of credentials) {
    const credential = normalizeToVcV2(item);
    const subject = credential.credentialSubject || {};

    const documentId =
      credential.documentId ||
      (typeof subject.documentId === 'string' ? subject.documentId : undefined) ||
      credential.id;

    const documentType =
      credential.documentType ||
      ((typeof subject.documentType === 'string' ? subject.documentType : 'CUSTOM') as DocumentType);

    const documentName =
      credential.documentName ||
      (typeof subject.documentName === 'string' ? subject.documentName : undefined) ||
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

export async function getCredentialDocumentById(
  documentId: string
): Promise<CredentialDocument | null> {
  const documents = await getCredentialDocuments();
  return documents.find((item) => item.documentId === documentId) || null;
}

export async function getCredentialByIdV2(
  credentialId: string
): Promise<VerifiableCredentialV2 | null> {
  const credential = await getVCById(credentialId);
  return credential ? normalizeToVcV2(credential) : null;
}