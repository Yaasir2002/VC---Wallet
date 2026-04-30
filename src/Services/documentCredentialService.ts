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
    const documentName = vc.documentName || 'Credential Document';

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

export async function createDummyKTP() {
  return await createDocumentCredentials({
    documentType: 'KTP',
    documentName: 'Kartu Tanda Penduduk',
    attributes: [
      {
        attributeType: 'legalName',
        attributeName: 'Nama Lengkap',
        attributeValue: 'John Doe',
      },
      {
        attributeType: 'nik',
        attributeName: 'NIK',
        attributeValue: '317xxxxxxxxxxxxx',
      },
      {
        attributeType: 'birthPlace',
        attributeName: 'Tempat Lahir',
        attributeValue: 'Bogor',
      },
      {
        attributeType: 'birthDate',
        attributeName: 'Tanggal Lahir',
        attributeValue: '2002-01-01',
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
    documentName: 'Surat Izin Mengemudi',
    attributes: [
      {
        attributeType: 'legalName',
        attributeName: 'Nama Lengkap',
        attributeValue: 'John Doe',
      },
      {
        attributeType: 'licenseNumber',
        attributeName: 'Nomor SIM',
        attributeValue: 'SIM-123456789',
      },
      {
        attributeType: 'licenseType',
        attributeName: 'Golongan SIM',
        attributeValue: 'SIM C',
      },
      {
        attributeType: 'birthDate',
        attributeName: 'Tanggal Lahir',
        attributeValue: '2002-01-01',
      },
    ],
  });
}

export async function createDummyIjazah() {
  return await createDocumentCredentials({
    documentType: 'IJAZAH',
    documentName: 'Ijazah Pendidikan',
    attributes: [
      {
        attributeType: 'legalName',
        attributeName: 'Nama Lengkap',
        attributeValue: 'John Doe',
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