import { CredentialVerificationResult } from '../types/verification';
import { validateCredentialExpiration } from './credentialExpirationService';
import { resolveDid } from './didResolverService';
import { getPublicKeyForJsonLdProof } from './issuerPublicKeyService';
import {
  extractIssuerId,
  validateTrustedIssuer,
} from './trustedIssuerService';

function createResult(params: {
  isVerified: boolean;
  status: CredentialVerificationResult['status'];
  reason?: string;
  issuer?: string;
  credentialId?: string;
  checks: CredentialVerificationResult['checks'];
  details?: Record<string, unknown>;
}): CredentialVerificationResult {
  return {
    isVerified: params.isVerified,
    isValid: params.isVerified,
    status: params.status,
    reason: params.reason,
    issuer: params.issuer,
    credentialId: params.credentialId,
    checkedAt: new Date().toISOString(),
    checks: params.checks,
    details: params.details,
  };
}

function hasJsonLdVcStructure(vc: any): boolean {
  if (!vc || typeof vc !== 'object' || Array.isArray(vc)) {
    return false;
  }

  const types = Array.isArray(vc.type) ? vc.type : [vc.type];

  return Boolean(
    vc['@context'] &&
      types.includes('VerifiableCredential') &&
      vc.issuer &&
      vc.credentialSubject
  );
}

function getCredentialTypes(vc: any): string[] {
  if (Array.isArray(vc?.type)) {
    return vc.type.filter((item: unknown) => typeof item === 'string');
  }

  if (typeof vc?.type === 'string') {
    return [vc.type];
  }

  return [];
}

function getProofType(vc: any): string | null {
  if (typeof vc?.proof?.type === 'string') {
    return vc.proof.type;
  }

  return null;
}

function getProofVerificationMethod(vc: any): string | null {
  if (typeof vc?.proof?.verificationMethod === 'string') {
    return vc.proof.verificationMethod;
  }

  return null;
}

function isKnownButNotEnabledProofType(proofType: string): boolean {
  return [
    'Ed25519Signature2018',
    'Ed25519Signature2020',
    'JsonWebSignature2020',
    'EcdsaSecp256k1Signature2019',
    'BbsBlsSignature2020',
    'DataIntegrityProof',
  ].includes(proofType);
}

export async function verifyJsonLdVc(
  vc: any
): Promise<CredentialVerificationResult> {
  const issuer = extractIssuerId(vc);
  const credentialId = typeof vc?.id === 'string' ? vc.id : undefined;
  const credentialTypes = getCredentialTypes(vc);

  if (!hasJsonLdVcStructure(vc)) {
    return createResult({
      isVerified: false,
      status: 'malformed_credential',
      reason: 'Struktur JSON-LD VC tidak valid',
      issuer: issuer ?? undefined,
      credentialId,
      checks: {
        structure: false,
        signature: false,
        expiration: false,
        trustedIssuer: false,
        didResolution: false,
        publicKeyResolution: false,
      },
    });
  }

  if (!vc.proof) {
    return createResult({
      isVerified: false,
      status: 'pending_verification',
      reason: 'Proof JSON-LD VC tidak ditemukan',
      issuer: issuer ?? undefined,
      credentialId,
      checks: {
        structure: true,
        signature: false,
        expiration: false,
        trustedIssuer: false,
        didResolution: false,
        publicKeyResolution: false,
      },
    });
  }

  const proofType = getProofType(vc);
  const verificationMethod = getProofVerificationMethod(vc);

  if (!proofType) {
    return createResult({
      isVerified: false,
      status: 'unsupported_proof_type',
      reason: 'proof.type tidak ditemukan',
      issuer: issuer ?? undefined,
      credentialId,
      checks: {
        structure: true,
        signature: false,
        expiration: false,
        trustedIssuer: false,
        didResolution: false,
        publicKeyResolution: false,
      },
    });
  }

  if (!issuer || !issuer.startsWith('did:')) {
    return createResult({
      isVerified: false,
      status: 'did_resolution_failed',
      reason: 'Issuer JSON-LD VC bukan DID yang valid',
      issuer: issuer ?? undefined,
      credentialId,
      checks: {
        structure: true,
        signature: false,
        expiration: false,
        trustedIssuer: false,
        didResolution: false,
        publicKeyResolution: false,
      },
    });
  }

  const expiration = validateCredentialExpiration(vc);

  if (expiration.isExpired) {
    return createResult({
      isVerified: false,
      status: 'expired',
      reason: expiration.reason,
      issuer,
      credentialId,
      checks: {
        structure: true,
        signature: false,
        expiration: false,
        trustedIssuer: false,
        didResolution: false,
        publicKeyResolution: false,
      },
      details: {
        expiration,
      },
    });
  }

  if (expiration.isNotYetValid) {
    return createResult({
      isVerified: false,
      status: 'not_yet_valid',
      reason: expiration.reason,
      issuer,
      credentialId,
      checks: {
        structure: true,
        signature: false,
        expiration: false,
        trustedIssuer: false,
        didResolution: false,
        publicKeyResolution: false,
      },
      details: {
        expiration,
      },
    });
  }

  const trustedIssuer = validateTrustedIssuer(issuer, credentialTypes);

  if (!trustedIssuer.isTrusted) {
    return createResult({
      isVerified: false,
      status: 'untrusted_issuer',
      reason: trustedIssuer.reason,
      issuer,
      credentialId,
      checks: {
        structure: true,
        signature: false,
        expiration: true,
        trustedIssuer: false,
        didResolution: false,
        publicKeyResolution: false,
      },
      details: {
        trustedIssuer,
      },
    });
  }

  const didResolution = await resolveDid(issuer);

  if (!didResolution.didDocument) {
    return createResult({
      isVerified: false,
      status: 'did_resolution_failed',
      reason: didResolution.error || 'DID issuer gagal di-resolve',
      issuer,
      credentialId,
      checks: {
        structure: true,
        signature: false,
        expiration: true,
        trustedIssuer: true,
        didResolution: false,
        publicKeyResolution: false,
      },
      details: {
        didResolution,
      },
    });
  }

  const publicKey = await getPublicKeyForJsonLdProof(
    didResolution.didDocument,
    verificationMethod
  );

  if (publicKey.error) {
    return createResult({
      isVerified: false,
      status: 'public_key_not_found',
      reason: publicKey.error,
      issuer,
      credentialId,
      checks: {
        structure: true,
        signature: false,
        expiration: true,
        trustedIssuer: true,
        didResolution: true,
        publicKeyResolution: false,
      },
      details: {
        verificationMethod: publicKey.verificationMethod,
      },
    });
  }

  if (isKnownButNotEnabledProofType(proofType)) {
    return createResult({
      isVerified: false,
      status: 'unsupported_proof_type',
      reason:
        `Proof type ${proofType} dikenali, tetapi signature suite JSON-LD belum dikonfigurasi. ` +
        'Credential tidak diberi status verified agar tidak terjadi fake verification.',
      issuer,
      credentialId,
      checks: {
        structure: true,
        signature: false,
        expiration: true,
        trustedIssuer: true,
        didResolution: true,
        publicKeyResolution: true,
      },
      details: {
        proofType,
        verificationMethod,
        verificationMethodResolved: publicKey.verificationMethod.id,
      },
    });
  }

  return createResult({
    isVerified: false,
    status: 'unsupported_proof_type',
    reason: `Proof type tidak didukung: ${proofType}`,
    issuer,
    credentialId,
    checks: {
      structure: true,
      signature: false,
      expiration: true,
      trustedIssuer: true,
      didResolution: true,
      publicKeyResolution: true,
    },
    details: {
      proofType,
      verificationMethod,
    },
  });
}