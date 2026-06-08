import { ModularCredential, SignedPresentationJWT } from '../types/vc';
import { normalizeToVcV2 } from './credentialV2Service';
import { safeLogger } from '../utils/safeLogger';
import { isJwtString, signVpJwtWithWallet } from './walletJwtSigner';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getAttributeLabel(credential: ModularCredential): string {
  const subject = credential.credentialSubject || {};

  return (
    (typeof subject.Nama === 'string' ? subject.Nama : undefined) ||
    (typeof subject.nama === 'string' ? subject.nama : undefined) ||
    (typeof subject.fullName === 'string' ? subject.fullName : undefined) ||
    credential.documentName ||
    credential.id ||
    'Credential'
  );
}

function getIssuerJwtFromCredential(credential: ModularCredential): string | null {
  const normalized = normalizeToVcV2(credential);

  const proofJwt =
    isRecord(normalized.proof) && typeof normalized.proof.jwt === 'string'
      ? normalized.proof.jwt
      : null;

  const candidates = [
    normalized.vcJwt,
    normalized.rawJwt,
    normalized.jwt,
    normalized.securedCredential,
    proofJwt,
  ];

  const jwt = candidates.find((value) => isJwtString(value));

  return typeof jwt === 'string' ? jwt.trim() : null;
}

function buildEnvelopedCredential(vcJwt: string) {
  return {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    type: ['EnvelopedVerifiableCredential'],
    id: `data:application/vc+jwt,${vcJwt}`,
  };
}

function buildVerifiablePresentation(params: {
  holderDid: string;
  issuerCredentialJwts: string[];
}) {
  return {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://www.w3.org/ns/credentials/examples/v2',
    ],
    type: 'VerifiablePresentation',
    holder: params.holderDid,
    verifiableCredential: params.issuerCredentialJwts.map((vcJwt) =>
      buildEnvelopedCredential(vcJwt)
    ),
  };
}

export async function createSignedPresentationJWT(params: {
  holderDid: string;
  credentials: ModularCredential[];
}): Promise<SignedPresentationJWT> {
  if (!params.holderDid?.startsWith('did:')) {
    throw new Error('Holder DID tidak valid.');
  }

  if (!Array.isArray(params.credentials) || params.credentials.length === 0) {
    throw new Error('Pilih minimal 1 credential.');
  }

  try {
    const issuerCredentialJwts = params.credentials
      .map((credential) => getIssuerJwtFromCredential(credential))
      .filter((jwt): jwt is string => Boolean(jwt));

    if (issuerCredentialJwts.length === 0) {
      throw new Error(
        'Credential ini belum memiliki raw VC JWT dari issuer, sehingga belum bisa dibuat menjadi VP JWT.'
      );
    }

    const vp = buildVerifiablePresentation({
      holderDid: params.holderDid,
      issuerCredentialJwts,
    });

    const jwt = await signVpJwtWithWallet({
      holderDid: params.holderDid,
      vp,
    });

    if (!isJwtString(jwt)) {
      throw new Error('Presentation tidak menghasilkan JWT valid.');
    }

    return {
      jwt: jwt.trim(),
      vpJwt: jwt.trim(),
      qrPayload: jwt.trim(),
      holderDid: params.holderDid,
      credentialCount: issuerCredentialJwts.length,
      createdAt: new Date().toISOString(),
      algorithm: 'EdDSA',
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Gagal membuat JWT presentation.';

    safeLogger.warn('Failed to create signed VP JWT', {
      message,
      credential: getAttributeLabel(params.credentials[0]),
    });

    throw new Error(`Gagal membuat JWT presentation. Detail: ${message}`);
  }
}