// File: src/config/securityLimits.ts

export const QR_JWT_MAX_LENGTH = 12000;
export const DID_DOCUMENT_MAX_BYTES = 128 * 1024;
export const DID_DOCUMENT_TIMEOUT_MS = 10000;

export const TRUSTED_VC_ISSUER_DID = 'did:web:identitylab.id';
export const TRUSTED_VC_ISSUER_DID_DOCUMENT_URL =
  'https://identitylab.id/.well-known/did.json';

export const VC_V2_CONTEXT_URL = 'https://www.w3.org/ns/credentials/v2';
export const VC_EXAMPLES_V2_CONTEXT_URL =
  'https://www.w3.org/ns/credentials/examples/v2';

export const VC_TYPE = 'VerifiableCredential';
export const VP_TYPE = 'VerifiablePresentation';
export const ENVELOPED_VC_TYPE = 'EnvelopedVerifiableCredential';

export const SUPPORTED_JWT_ALG = 'ES256';

export const MAX_PRESENTATION_JWT_BYTES = 12000;
export const MAX_PRESENTATION_QR_BYTES = 12000;
export const PRESENTATION_QR_WARNING_BYTES = 8000;