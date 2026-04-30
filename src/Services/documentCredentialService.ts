import { getDID } from '../Storage/didStorage';
import { saveVC, getAllVCs } from '../Storage/vcStorage';
import {
  AttributeType,
  DocumentType,
  CredentialDocument,
  ModularCredential,
} from '../types/vc';
import { createAttributeCredential } from './credentialService';

type DocumentAttributeInput = {
  attributeType: AttributeType;
  attributeName: string;
  attributeValue: string;
  expirationDate?: string;
};

export async function createDocumentCredentials(params: {
  documentType: DocumentType;
  documentName: string;
  attributes: DocumentAttributeInput[];
}) {
  const didData = await getDID();

  if (!didData?.did) {
    throw new Error('DID belum dibuat');
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

    await saveVC(vc);
    createdCredentials.push(vc);
  }

  return createdCredentials;
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
  if (documentType === 'SIM') return 'SIM Digital';
  if (documentType === 'IJAZAH') return 'Ijazah Digital';

  return 'Credential Document';
}

export async function createDummyKTP() {
  return await createDocumentCredentials({
    documentType: 'KTP',
    documentName: 'KTP Digital',
    attributes: [
      {
        attributeType: 'legalName',
        attributeName: 'Nama Lengkap',
        attributeValue: 'Muhammad Yaasir',
      },
      {
        attributeType: 'nik',
        attributeName: 'NIK',
        attributeValue: '3276010101020001',
      },
      {
        attributeType: 'birthPlace',
        attributeName: 'Tempat Lahir',
        attributeValue: 'Bogor',
      },
      {
        attributeType: 'birthDate',
        attributeName: 'Tanggal Lahir',
        attributeValue: '01 Januari 2002',
      },
      {
        attributeType: 'address',
        attributeName: 'Alamat',
        attributeValue: 'Bogor, Jawa Barat',
      },
      {
        attributeType: 'citizenship',
        attributeName: 'Kewarganegaraan',
        attributeValue: 'WNI',
      },
    ],
  });
}

export async function createDummySIM() {
  return await createDocumentCredentials({
    documentType: 'SIM',
    documentName: 'SIM Digital',
    attributes: [
      {
        attributeType: 'legalName',
        attributeName: 'Nama Lengkap',
        attributeValue: 'Muhammad Yaasir',
      },
      {
        attributeType: 'licenseNumber',
        attributeName: 'Nomor SIM',
        attributeValue: 'SIM-C-3276010101020001',
      },
      {
        attributeType: 'licenseType',
        attributeName: 'Golongan SIM',
        attributeValue: 'SIM C',
      },
      {
        attributeType: 'birthDate',
        attributeName: 'Tanggal Lahir',
        attributeValue: '01 Januari 2002',
      },
    ],
  });
}

export async function createDummyIjazah() {
  return await createDocumentCredentials({
    documentType: 'IJAZAH',
    documentName: 'Ijazah Digital',
    attributes: [
      {
        attributeType: 'legalName',
        attributeName: 'Nama Lengkap',
        attributeValue: 'Muhammad Yaasir',
      },
      {
        attributeType: 'studentId',
        attributeName: 'NISN/NIM',
        attributeValue: '2026001234',
      },
      {
        attributeType: 'schoolName',
        attributeName: 'Nama Sekolah/Kampus',
        attributeValue: 'STT Terpadu Nurul Fikri',
      },
      {
        attributeType: 'major',
        attributeName: 'Program Studi',
        attributeValue: 'Teknik Informatika',
      },
      {
        attributeType: 'graduationYear',
        attributeName: 'Tahun Lulus',
        attributeValue: '2026',
      },
    ],
  });
}