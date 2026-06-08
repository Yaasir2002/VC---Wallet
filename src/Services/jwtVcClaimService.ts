// File: src/Services/jwtVcClaimService.ts

import {
  QR_JWT_MAX_LENGTH,
  SUPPORTED_JWT_ALG,
  TRUSTED_VC_ISSUER_DID,
  VC_TYPE,
  VC_V2_CONTEXT_URL,
} from '../config/securityLimits';
import {
  ClaimedJwtCredential,
  CredentialPreviewClaim,
  JwtVcV2Payload,
} from '../types/credential';
import { DecodedJwt, JwtHeader } from '../types/jwt';
import { base64UrlToJson } from '../utils/base64url';
import { isRecord } from '../utils/safeJson';
import { resolveDidWebPublicKey } from './didWebResolver';
import { verifyEs256JwtSignature } from './es256JwtVerifier';

export type VerifiedJwtVcClaim = {
  claimedCredential: ClaimedJwtCredential;
  preview: CredentialPreviewClaim;
};

function assertQrPayloadSize(value: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error('QR bukan JWT credential claim yang valid.');
  }

  if (value.length > QR_JWT_MAX_LENGTH) {
    throw new Error('QR terlalu besar untuk diproses.');
  }
}

function parseJwtCompact(rawValue: string): DecodedJwt<JwtVcV2Payload> {
  const rawJwt = rawValue.trim();
  assertQrPayloadSize(rawJwt);

  const parts = rawJwt.split('.');

  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw new Error('QR bukan JWT credential claim yang valid.');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  let header: JwtHeader;
  let payload: JwtVcV2Payload;

  try {
    header = base64UrlToJson<JwtHeader>(encodedHeader);
    payload = base64UrlToJson<JwtVcV2Payload>(encodedPayload);
  } catch {
    throw new Error('JWT credential tidak dapat dibaca.');
  }

  return {
    rawJwt,
    header,
    payload,
    parts: {
      rawJwt,
      encodedHeader,
      encodedPayload,
      encodedSignature,
      signingInput: `${encodedHeader}.${encodedPayload}`,
    },
  };
}

function assertJwtHeader(header: JwtHeader): void {
  if (!isRecord(header)) {
    throw new Error('Header JWT tidak valid.');
  }

  if (header.alg !== SUPPORTED_JWT_ALG) {
    throw new Error('unsupported_algorithm');
  }

  if (typeof header.kid !== 'string' || header.kid.trim().length === 0) {
    throw new Error('JWT tidak memiliki key id.');
  }

  if (
    typeof header.iss === 'string' &&
    header.iss !== TRUSTED_VC_ISSUER_DID
  ) {
    throw new Error('untrusted_issuer');
  }
}

function assertVcV2Payload(payload: JwtVcV2Payload): void {
  if (!isRecord(payload)) {
    throw new Error('Payload JWT tidak valid.');
  }

  if (!Array.isArray(payload['@context'])) {
    throw new Error('Credential bukan VC Data Model v2.');
  }

  if (!payload['@context'].includes(VC_V2_CONTEXT_URL)) {
    throw new Error('Credential bukan VC Data Model v2.');
  }

  if (!Array.isArray(payload.type) || !payload.type.includes(VC_TYPE)) {
    throw new Error('Credential bukan Verifiable Credential.');
  }

  if (typeof payload.id !== 'string' || payload.id.trim().length === 0) {
    throw new Error('Credential ID tidak valid.');
  }

  if (payload.issuer !== TRUSTED_VC_ISSUER_DID) {
    throw new Error('untrusted_issuer');
  }

  if (!isRecord(payload.credentialSubject)) {
    throw new Error('Credential subject tidak valid.');
  }

  if (
    payload.credentialSubject.id !== undefined &&
    typeof payload.credentialSubject.id !== 'string'
  ) {
    throw new Error('Subject ID credential tidak valid.');
  }
}

function buildPreview(payload: JwtVcV2Payload): CredentialPreviewClaim {
  const credentialTypes = payload.type.filter(
    (item) => item !== 'VerifiableCredential'
  );

  const credentialType =
    credentialTypes.length > 0
      ? credentialTypes.join(', ')
      : 'VerifiableCredential';

  const subject = payload.credentialSubject;
  const subjectName =
    typeof subject.Nama === 'string'
      ? subject.Nama
      : typeof subject.name === 'string'
        ? subject.name
        : typeof subject.fullName === 'string'
          ? subject.fullName
          : undefined;

  return {
    credentialType,
    issuer: payload.issuer,
    credentialId: payload.id,
    subjectId: typeof subject.id === 'string' ? subject.id : '-',
    subjectName,
    issuanceDate: payload.issuanceDate || payload.validFrom,
    credentialSubject: subject,
    verificationStatus: 'signature_verified',
  };
}

export async function verifyJwtVcClaimFromQr(
  qrData: string
): Promise<VerifiedJwtVcClaim> {
  const decoded = parseJwtCompact(qrData);

  assertJwtHeader(decoded.header);
  assertVcV2Payload(decoded.payload);

  const { publicKeyJwk } = await resolveDidWebPublicKey(
    decoded.payload.issuer,
    decoded.header.kid
  );

  const signatureValid = verifyEs256JwtSignature({
    header: decoded.header,
    encodedSignature: decoded.parts.encodedSignature,
    signingInput: decoded.parts.signingInput,
    publicKeyJwk,
  });

  if (!signatureValid) {
    throw new Error('invalid_signature');
  }

  const importedAt = new Date().toISOString();

  const claimedCredential: ClaimedJwtCredential = {
    id: decoded.payload.id,
    vcJwt: decoded.rawJwt,
    rawJwt: decoded.rawJwt,
    decodedHeader: decoded.header,
    decodedCredential: decoded.payload,
    verificationStatus: 'signature_verified',
    signatureVerified: true,
    issuer: decoded.payload.issuer,
    credentialSubject: decoded.payload.credentialSubject,
    source: 'qr_jwt_claim',
    importedAt,
  };

  return {
    claimedCredential,
    preview: buildPreview(decoded.payload),
  };
}