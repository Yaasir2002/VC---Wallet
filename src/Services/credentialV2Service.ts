import * as Crypto from 'expo-crypto';

import {
  CredentialIssuer,
  CredentialMetadata,
  CredentialStatus,
  CredentialSubject,
  DocumentType,
  VerifiableCredentialV2,
  VerificationStatus,
} from '../types/vc';

export const VC_V2_CONTEXT = 'https://www.w3.org/ns/credentials/v2';
export const VC_V1_CONTEXT = 'https://www.w3.org/2018/credentials/v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(prefix = 'urn:uuid'): string {
  const uuid =
    typeof Crypto.randomUUID === 'function'
      ? Crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${prefix}:${uuid}`;
}

function normalizeContext(value: unknown): string[] {
  const contexts = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : typeof value === 'string'
      ? [value]
      : [];

  const withoutLegacyOnly = contexts.filter((item) => item !== VC_V1_CONTEXT);

  return Array.from(new Set([VC_V2_CONTEXT, ...withoutLegacyOnly]));
}

function normalizeTypes(value: unknown, fallbackType = 'CustomCredential'): string[] {
  const types = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim())
    : typeof value === 'string' && value.trim()
      ? [value]
      : [];

  return Array.from(new Set(['VerifiableCredential', ...types, fallbackType]));
}

export function isVcV2Credential(value: unknown): value is VerifiableCredentialV2 {
  if (!isRecord(value)) return false;

  const context = value['@context'];

  return (
    Array.isArray(context) &&
    context.includes(VC_V2_CONTEXT) &&
    Array.isArray(value.type) &&
    value.type.includes('VerifiableCredential') &&
    isRecord(value.credentialSubject) &&
    typeof value.validFrom === 'string'
  );
}

export function getCredentialSubject(
  credential: Partial<VerifiableCredentialV2> | Record<string, unknown> | null | undefined
): CredentialSubject {
  if (!credential || !isRecord(credential)) return {};

  const subject = credential.credentialSubject;

  if (isRecord(subject)) {
    return subject as CredentialSubject;
  }

  return {};
}

export function getCredentialValidFrom(credential: any): string {
  return credential?.validFrom || credential?.issuanceDate || credential?.nbf || '-';
}

export function getCredentialValidUntil(credential: any): string | undefined {
  return credential?.validUntil || credential?.expirationDate || credential?.exp;
}

export function getCredentialIssuer(credential: any): CredentialIssuer {
  const issuer = credential?.issuer;

  if (typeof issuer === 'string' && issuer.trim()) {
    return { id: issuer };
  }

  if (isRecord(issuer) && typeof issuer.id === 'string') {
    return {
      ...issuer,
      id: issuer.id,
      name: typeof issuer.name === 'string' ? issuer.name : undefined,
    };
  }

  return { id: '-' };
}

export function getCredentialDisplayName(credential: any): string {
  if (!credential) return 'Credential';

  if (typeof credential.documentName === 'string' && credential.documentName.trim()) {
    return credential.documentName;
  }

  if (
    isRecord(credential.metadata) &&
    typeof credential.metadata.documentName === 'string' &&
    credential.metadata.documentName.trim()
  ) {
    return credential.metadata.documentName;
  }

  const subject = getCredentialSubject(credential);

  if (typeof subject.documentName === 'string' && subject.documentName.trim()) {
    return subject.documentName;
  }

  const types = Array.isArray(credential.type) ? credential.type : [];

  const specificType = types.find(
    (item: unknown) => typeof item === 'string' && item !== 'VerifiableCredential'
  );

  return typeof specificType === 'string' ? specificType : 'Credential';
}

export function getCredentialStatus(credential: any): CredentialStatus {
  if (isRecord(credential?.credentialStatus)) {
    const status = credential.credentialStatus as Record<string, unknown>;

    return {
      ...status,
      type: typeof status.type === 'string' ? status.type : 'CredentialStatus',
      status: typeof status.status === 'string' ? status.status : undefined,
    };
  }

  return {
    type: 'CredentialStatus',
    status: 'active',
  };
}

function getProofStatus(credential: any): CredentialMetadata['proofStatus'] {
  if (typeof credential?.jwt === 'string' && credential.jwt.split('.').length === 3) {
    return 'jwt';
  }

  if (typeof credential?.proof?.jwt === 'string') {
    return 'jwt';
  }

  if (credential?.proof) {
    return 'present';
  }

  return 'none';
}

function inferVerificationStatus(credential: any): VerificationStatus {
  const metadataStatus = credential?.metadata?.verificationStatus;
  const directStatus = credential?.verificationStatus;

  if (typeof metadataStatus === 'string') return metadataStatus as VerificationStatus;
  if (typeof directStatus === 'string') return directStatus as VerificationStatus;

  if (credential?.proof || credential?.jwt) {
    return 'signed_unverified';
  }

  return 'unsigned';
}

function extractDocumentType(value: unknown): DocumentType {
  if (
    value === 'KTP' ||
    value === 'KTM' ||
    value === 'SIM' ||
    value === 'IJAZAH' ||
    value === 'CUSTOM'
  ) {
    return value;
  }

  return 'CUSTOM';
}

export type BuildVcV2CredentialInput = {
  id?: string;
  type?: string[];
  issuer: string | CredentialIssuer;
  validFrom?: string;
  validUntil?: string;
  credentialSubject: CredentialSubject;
  credentialStatus?: CredentialStatus;
  proof?: unknown;
  jwt?: string;
  metadata?: Partial<CredentialMetadata>;
  documentId?: string;
  documentType?: DocumentType;
  documentName?: string;
  source?: CredentialMetadata['source'];
};

export function buildVcV2Credential(input: BuildVcV2CredentialInput): VerifiableCredentialV2 {
  const createdAt = input.metadata?.createdAt || nowIso();
  const updatedAt = nowIso();

  const issuer =
    typeof input.issuer === 'string'
      ? { id: input.issuer }
      : {
          ...input.issuer,
          id: input.issuer.id,
        };

  const documentId =
    input.documentId ||
    (typeof input.credentialSubject.documentId === 'string'
      ? input.credentialSubject.documentId
      : undefined) ||
    randomId('urn:document');

  const documentType =
    input.documentType ||
    extractDocumentType(input.credentialSubject.documentType);

  const documentName =
    input.documentName ||
    (typeof input.credentialSubject.documentName === 'string'
      ? input.credentialSubject.documentName
      : undefined) ||
    'Credential Document';

  const credentialSubject: CredentialSubject = {
    ...input.credentialSubject,
  };

  if (!credentialSubject.id && typeof input.credentialSubject.id === 'string') {
    credentialSubject.id = input.credentialSubject.id;
  }

  credentialSubject.documentId = documentId;
  credentialSubject.documentType = documentType;
  credentialSubject.documentName = documentName;

  const credential: VerifiableCredentialV2 = {
    '@context': [VC_V2_CONTEXT],
    id: input.id || randomId(),
    type: normalizeTypes(input.type, `${documentType}Credential`),
    issuer,
    validFrom: input.validFrom || nowIso(),
    credentialSubject,
    credentialStatus:
      input.credentialStatus ||
      {
        type: 'CredentialStatus',
        status: 'active',
      },
    metadata: {
      schemaVersion: 'vc-data-model-v2.0',
      source: input.source || input.metadata?.source || 'wallet',
      verificationStatus:
        input.metadata?.verificationStatus ||
        (input.proof || input.jwt ? 'signed_unverified' : 'unsigned'),
      proofStatus: input.metadata?.proofStatus || getProofStatus(input),
      createdAt,
      updatedAt,
      originalFormat: input.metadata?.originalFormat || 'vc-v2',
      jwt: input.jwt || input.metadata?.jwt,
      documentId,
      documentType,
      documentName,
      ...input.metadata,
    },
    documentId,
    documentType,
    documentName,
    verificationStatus:
      input.metadata?.verificationStatus ||
      (input.proof || input.jwt ? 'signed_unverified' : 'unsigned'),
  };

  if (input.validUntil) credential.validUntil = input.validUntil;
  if (input.proof) credential.proof = input.proof;
  if (input.jwt) credential.jwt = input.jwt;

  return credential;
}

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const [, payload] = jwt.trim().split('.');

    if (!payload) return null;

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '='
    );

    const decoded =
      typeof atob === 'function'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('utf8');

    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function normalizeJwtVc(jwt: string): VerifiableCredentialV2 {
  const payload = decodeJwtPayload(jwt);
  const vc = isRecord(payload?.vc) ? payload.vc : {};

  const validFrom =
    typeof vc.validFrom === 'string'
      ? vc.validFrom
      : typeof vc.issuanceDate === 'string'
        ? vc.issuanceDate
        : typeof payload?.nbf === 'number'
          ? new Date(payload.nbf * 1000).toISOString()
          : nowIso();

  const validUntil =
    typeof vc.validUntil === 'string'
      ? vc.validUntil
      : typeof vc.expirationDate === 'string'
        ? vc.expirationDate
        : typeof payload?.exp === 'number'
          ? new Date(payload.exp * 1000).toISOString()
          : undefined;

  const subject =
    isRecord(vc.credentialSubject)
      ? (vc.credentialSubject as CredentialSubject)
      : {
          id: typeof payload?.sub === 'string' ? payload.sub : undefined,
          importedJwt: '[JWT Credential]',
        };

  return buildVcV2Credential({
    id: typeof payload?.jti === 'string' ? payload.jti : randomId(),
    type: Array.isArray(vc.type) ? (vc.type as string[]) : ['VerifiableCredential'],
    issuer:
      typeof vc.issuer === 'string'
        ? vc.issuer
        : isRecord(vc.issuer) && typeof vc.issuer.id === 'string'
          ? (vc.issuer as CredentialIssuer)
          : typeof payload?.iss === 'string'
            ? payload.iss
            : '-',
    validFrom,
    validUntil,
    credentialSubject: subject,
    proof: {
      type: 'JwtProof2020',
      jwt,
      created: validFrom,
      proofPurpose: 'assertionMethod',
      verificationMethod: typeof payload?.iss === 'string' ? payload.iss : '-',
    },
    jwt,
    metadata: {
      schemaVersion: 'vc-data-model-v2.0',
      source: 'import',
      verificationStatus: 'signed_unverified',
      proofStatus: 'jwt',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      originalFormat: 'jwt-vc',
      jwt,
    },
    source: 'import',
  });
}

export function normalizeToVcV2(input: unknown): VerifiableCredentialV2 {
  if (typeof input === 'string') {
    const trimmed = input.trim();

    if (trimmed.split('.').length === 3) {
      return normalizeJwtVc(trimmed);
    }

    try {
      return normalizeToVcV2(JSON.parse(trimmed));
    } catch {
      return buildVcV2Credential({
        issuer: '-',
        credentialSubject: {
          importedRaw: trimmed,
        },
        metadata: {
          schemaVersion: 'vc-data-model-v2.0',
          source: 'import',
          verificationStatus: 'unsupported_format',
          proofStatus: 'none',
          createdAt: nowIso(),
          updatedAt: nowIso(),
          originalFormat: 'unknown',
        },
      });
    }
  }

  if (!isRecord(input)) {
    return buildVcV2Credential({
      issuer: '-',
      credentialSubject: {},
      metadata: {
        schemaVersion: 'vc-data-model-v2.0',
        source: 'import',
        verificationStatus: 'unsupported_format',
        proofStatus: 'none',
        createdAt: nowIso(),
        updatedAt: nowIso(),
        originalFormat: 'unknown',
      },
    });
  }

  if (isRecord(input.verifiableCredential)) {
    return normalizeToVcV2(input.verifiableCredential);
  }

  if (typeof input.vc === 'string') {
    return normalizeToVcV2(input.vc);
  }

  if (typeof input.jwt === 'string' && input.jwt.split('.').length === 3) {
    const normalized = normalizeJwtVc(input.jwt);

    return {
      ...normalized,
      ...normalizeToVcV2({
        ...input,
        jwt: undefined,
      }),
      jwt: input.jwt,
      proof: input.proof || normalized.proof,
    };
  }

  const subject = getCredentialSubject(input);

  const validFrom =
    typeof input.validFrom === 'string'
      ? input.validFrom
      : typeof input.issuanceDate === 'string'
        ? input.issuanceDate
        : nowIso();

  const validUntil =
    typeof input.validUntil === 'string'
      ? input.validUntil
      : typeof input.expirationDate === 'string'
        ? input.expirationDate
        : undefined;

  const documentId =
    typeof input.documentId === 'string'
      ? input.documentId
      : typeof subject.documentId === 'string'
        ? subject.documentId
        : undefined;

  const documentType = extractDocumentType(
    input.documentType || subject.documentType
  );

  const documentName =
    typeof input.documentName === 'string'
      ? input.documentName
      : typeof subject.documentName === 'string'
        ? subject.documentName
        : getCredentialDisplayName(input);

  const credential = buildVcV2Credential({
    id: typeof input.id === 'string' ? input.id : undefined,
    type: normalizeTypes(input.type, `${documentType}Credential`),
    issuer: getCredentialIssuer(input),
    validFrom,
    validUntil,
    credentialSubject: subject,
    credentialStatus: getCredentialStatus(input),
    proof: input.proof,
    jwt: typeof input.jwt === 'string' ? input.jwt : undefined,
    documentId,
    documentType,
    documentName,
    metadata: {
      schemaVersion: 'vc-data-model-v2.0',
      source:
        typeof input.source === 'string'
          ? (input.source as CredentialMetadata['source'])
          : 'legacy-migration',
      verificationStatus: inferVerificationStatus(input),
      proofStatus: getProofStatus(input),
      createdAt:
        isRecord(input.metadata) && typeof input.metadata.createdAt === 'string'
          ? input.metadata.createdAt
          : validFrom,
      updatedAt: nowIso(),
      originalFormat: isVcV2Credential(input) ? 'vc-v2' : 'vc-v1.1',
      ...(isRecord(input.metadata) ? input.metadata : {}),
    },
  });

  return {
    ...credential,
    issuanceDate:
      typeof input.issuanceDate === 'string' ? input.issuanceDate : undefined,
    expirationDate:
      typeof input.expirationDate === 'string' ? input.expirationDate : undefined,
    verificationResult: input.verificationResult,
    verification: input.verification,
    verifiedAt:
      typeof input.verifiedAt === 'string' || input.verifiedAt === null
        ? input.verifiedAt
        : null,
    importedAt:
      typeof input.importedAt === 'string' ? input.importedAt : undefined,
    source: typeof input.source === 'string' ? input.source : undefined,
  };
}

export function filterCredentialSubjectAttributes(
  credential: VerifiableCredentialV2,
  selectedAttributes?: string[]
): VerifiableCredentialV2 {
  if (!selectedAttributes || selectedAttributes.length === 0) {
    return credential;
  }

  const allowed = new Set(['id', 'documentId', 'documentType', 'documentName', ...selectedAttributes]);
  const filteredSubject: CredentialSubject = {};

  for (const [key, value] of Object.entries(credential.credentialSubject || {})) {
    if (allowed.has(key)) {
      filteredSubject[key] = value;
    }
  }

  return {
    ...credential,
    credentialSubject: filteredSubject,
    metadata: {
      ...credential.metadata,
      schemaVersion: 'vc-data-model-v2.0',
      updatedAt: nowIso(),
    },
  };
}