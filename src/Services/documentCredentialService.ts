import { getDID } from '../Storage/didStorage';
import { saveVC, getAllVCs } from '../Storage/vcStorage';
import {
  AttributeType,
  DocumentType,
  CredentialDocument,
  ModularCredential,
} from '../types/vc';
import { createAttributeCredential } from './credentialService';
import { isJwtString } from './walletJwtSigner';

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

  const documentId = `${params.documentType}-${Date.now()}`;
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

export async function createKtpCredential(input: KtpCredentialInput) {
  const attributes: DocumentAttributeInput[] = [
    {
      attributeType: 'legalName',
      attributeName: 'Nama Lengkap',
      attributeValue: input.fullName,
    },
    {
      attributeType: 'nik',
      attributeName: 'NIK',
      attributeValue: input.nik,
    },
    {
      attributeType: 'birthPlace',
      attributeName: 'Tempat Lahir',
      attributeValue: input.birthPlace,
    },
    {
      attributeType: 'birthDate',
      attributeName: 'Tanggal Lahir',
      attributeValue: input.birthDate,
    },
    {
      attributeType: 'gender',
      attributeName: 'Jenis Kelamin',
      attributeValue: input.gender,
    },
    {
      attributeType: 'address',
      attributeName: 'Alamat',
      attributeValue: input.address,
    },
    {
      attributeType: 'religion',
      attributeName: 'Agama',
      attributeValue: input.religion,
    },
    {
      attributeType: 'maritalStatus',
      attributeName: 'Status Perkawinan',
      attributeValue: input.maritalStatus,
    },
    {
      attributeType: 'occupation',
      attributeName: 'Pekerjaan',
      attributeValue: input.occupation,
    },
    {
      attributeType: 'citizenship',
      attributeName: 'Kewarganegaraan',
      attributeValue: input.citizenship,
    },
  ];

  if (input.validUntil) {
    attributes.push({
      attributeType: 'validUntil',
      attributeName: 'Berlaku Hingga',
      attributeValue: input.validUntil,
    });
  }

  return await createDocumentCredentials({
    documentType: 'KTP',
    documentName: 'KTP Digital',
    attributes,
  });
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