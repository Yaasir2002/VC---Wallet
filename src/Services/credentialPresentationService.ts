import { CredentialDocument, ModularCredential } from '../types/vc';

export type SelectedAttributeMap = Record<string, boolean>;

export type PresentationAttribute = {
  id: string;
  attributeName: string;
  attributeType: string;
  attributeValue: string;
};

export type CredentialPresentationPayload = {
  type: 'VerifiablePresentation';
  holder: string;
  verifiableCredential: {
    id: string;
    documentId: string;
    documentType: string;
    documentName: string;
    type: string[];
    issuer: string;
    issuanceDate: string;
    expirationDate?: string;
    credentialSubject: Record<string, string>;
  };
  presentationMetadata: {
    selectedAttributes: string[];
    createdAt: string;
    disclosureMode: 'ui_level_attribute_selection';
    presentationStatus: 'unsigned_presentation';
    note: string;
  };
};

const MAX_QR_PAYLOAD_LENGTH = 2500;

export function extractPresentationAttributes(
  document: CredentialDocument
): PresentationAttribute[] {
  return document.credentials.map((credential) => ({
    id: credential.id,
    attributeName:
      credential.credentialSubject?.attributeName || 'Credential Attribute',
    attributeType: credential.credentialSubject?.attributeType || 'custom',
    attributeValue: sanitizePresentationValue(
      credential.credentialSubject?.attributeValue
    ),
  }));
}

export function createDefaultSelectedAttributes(
  attributes: PresentationAttribute[]
): SelectedAttributeMap {
  return attributes.reduce<SelectedAttributeMap>((result, attribute) => {
    result[attribute.id] = true;
    return result;
  }, {});
}

export function buildCredentialPresentationPayload(
  document: CredentialDocument,
  selectedAttributes: SelectedAttributeMap
): CredentialPresentationPayload {
  const selectedCredentials = document.credentials.filter(
    (credential) => selectedAttributes[credential.id]
  );

  if (selectedCredentials.length === 0) {
    throw new Error('Pilih minimal satu atribut untuk dipresentasikan.');
  }

  const mainCredential = getMainCredential(document);
  const holder = mainCredential?.credentialSubject?.id || '-';

  const selectedClaims = selectedCredentials.reduce<Record<string, string>>(
    (result, credential) => {
      const key =
        credential.credentialSubject?.attributeType ||
        credential.credentialSubject?.attributeName ||
        credential.id;

      result[key] = sanitizePresentationValue(
        credential.credentialSubject?.attributeValue
      );

      return result;
    },
    {}
  );

  return {
    type: 'VerifiablePresentation',
    holder,
    verifiableCredential: {
      id: mainCredential?.id || document.documentId,
      documentId: document.documentId,
      documentType: document.documentType,
      documentName: document.documentName,
      type: mainCredential?.type || ['VerifiableCredential'],
      issuer: mainCredential?.issuer || '-',
      issuanceDate: mainCredential?.issuanceDate || new Date().toISOString(),
      expirationDate: mainCredential?.expirationDate,
      credentialSubject: selectedClaims,
    },
    presentationMetadata: {
      selectedAttributes: selectedCredentials.map(
        (credential) => credential.credentialSubject?.attributeName || credential.id
      ),
      createdAt: new Date().toISOString(),
      disclosureMode: 'ui_level_attribute_selection',
      presentationStatus: 'unsigned_presentation',
      note:
        'This presentation uses UI-level attribute selection only. It is not cryptographic selective disclosure.',
    },
  };
}

export function stringifyPresentationPayload(
  payload: CredentialPresentationPayload
): string {
  const json = JSON.stringify(payload);

  if (json.length > MAX_QR_PAYLOAD_LENGTH) {
    throw new Error(
      'Payload QR terlalu besar. Kurangi jumlah atribut yang dipresentasikan.'
    );
  }

  return json;
}

function getMainCredential(
  document: CredentialDocument
): ModularCredential | undefined {
  const credentials = document.credentials ?? [];

  return (
    credentials.find(
      (vc) => vc.credentialSubject?.attributeType === 'legalName'
    ) ||
    credentials.find((vc) => vc.credentialSubject?.attributeType === 'nik') ||
    credentials.find(
      (vc) => vc.credentialSubject?.attributeType === 'studentId'
    ) ||
    credentials.find(
      (vc) => vc.credentialSubject?.attributeType === 'licenseNumber'
    ) ||
    credentials[0]
  );
}

function sanitizePresentationValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }

  const text =
    typeof value === 'string' ? value : JSON.stringify(value, null, 2);

  return text
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, 700);
}