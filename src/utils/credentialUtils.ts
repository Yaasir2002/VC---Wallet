import { CredentialDocument } from '../types/vc';

export function getDocumentDisplayName(document: CredentialDocument) {
  if (document.documentName) {
    return document.documentName;
  }

  if (document.documentType === 'KTP') return 'KTP Digital';
  if (document.documentType === 'KTM') return 'KTM Digital';
  if (document.documentType === 'SIM') return 'SIM Digital';
  if (document.documentType === 'IJAZAH') return 'Ijazah Digital';

  return 'Credential Document';
}

export function getDocumentIcon(documentType: string) {
  if (documentType === 'KTP') return 'id-card-outline';
  if (documentType === 'KTM') return 'school-outline';
  if (documentType === 'SIM') return 'car-outline';
  if (documentType === 'IJAZAH') return 'school-outline';

  return 'document-text-outline';
}

export function getMainCredential(document: CredentialDocument) {
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

export function getParentCredentialIssuer(document: CredentialDocument) {
  const mainCredential = getMainCredential(document);

  if (mainCredential?.issuer) {
    return mainCredential.issuer;
  }

  return 'Unknown Issuer';
}

export function getParentCredentialStatus(document: CredentialDocument) {
  const mainCredential = getMainCredential(document);

  if (!mainCredential?.expirationDate) {
    return {
      status: 'VALID',
      label: 'VALID',
    };
  }

  const isExpired = new Date(mainCredential.expirationDate) < new Date();

  return {
    status: isExpired ? 'EXPIRED' : 'VALID',
    label: isExpired ? 'EXPIRED' : 'VALID',
  };
}
