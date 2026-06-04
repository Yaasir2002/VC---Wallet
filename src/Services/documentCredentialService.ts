// File: src/Services/documentCredentialService.ts

import { getDID } from '../Storage/didStorage';
import { getAllVCs, getVCById, saveVC } from '../Storage/vcStorage';
import {
  AttributeType,
  CredentialDocument,
  DocumentType,
  KtpCredentialInput,
  VerifiableCredentialV2,
} from '../types/vc';
import {
  buildKtpCredential,
  buildCredentialSubject,
  createCredentialId,
  createIssuanceDate,
  groupCredentialsByDocument,
  normalizeCredentialToV2,
  normalizeKtpFormData,
  validateKtpFormData,
  DEFAULT_ISSUER_DID,
  VC_EXAMPLES_V2_CONTEXT,
  VC_V2_CONTEXT,
} from './credentialV2Service';

type DocumentAttributeInput = {
  attributeType: AttributeType;
  attributeName: string;
  attributeValue: string;
  expirationDate?: string;
};

/**
 * Legacy compatibility:
 * fungsi lama tetap ada, tapi hasilnya satu credential utuh.
 */
export async function createDocumentCredentials(params: {
  documentType: DocumentType;
  documentName: string;
  attributes: DocumentAttributeInput[];
}): Promise<VerifiableCredentialV2[]> {
  const didData = await getDID();

  if (!didData?.did) {
    throw new Error('DID belum dibuat.');
  }

  const issuanceDate = createIssuanceDate();
  const documentId = `${params.documentType}-${Date.now()}`;

  const subject: Record<string, unknown> = {
    id: didData.did,
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
    '@context': [VC_V2_CONTEXT, VC_EXAMPLES_V2_CONTEXT],
    type: ['VerifiableCredential'],
    id: createCredentialId(),
    issuer: DEFAULT_ISSUER_DID,
    issuanceDate,
    credentialSubject: subject,
    documentId,
    documentType: params.documentType,
    documentName: params.documentName,
    verificationStatus: 'unsigned',
    metadata: {
      schemaVersion: 'vc-json-v2',
      source: 'manual',
      verificationStatus: 'unsigned',
      proofStatus: 'none',
      createdAt: issuanceDate,
      updatedAt: issuanceDate,
      documentId,
      documentType: params.documentType,
      documentName: params.documentName,
    },
  };

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

  validateKtpFormData(input);

  const credential = buildKtpCredential(input, didData.did);

  await saveVC(credential);

  return credential;
}

export async function getCredentialDocuments(): Promise<CredentialDocument[]> {
  const credentials = await getAllVCs();
  const normalized = credentials
    .map((credential) => {
      try {
        return normalizeCredentialToV2(credential);
      } catch {
        return null;
      }
    })
    .filter((credential): credential is VerifiableCredentialV2 => Boolean(credential));

  return groupCredentialsByDocument(normalized);
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

  return credential ? normalizeCredentialToV2(credential) : null;
}