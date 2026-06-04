import { ModularCredential } from '../types/vc';
import { isJwtString, signVpJwtWithWallet } from './walletJwtSigner';
import { safeLogger } from '../utils/safeLogger';
import { VC_V2_CONTEXT } from './credentialV2Service';

export type SignedPresentationJWT = {
  jwt: string;
  holderDid: string;
  credentialCount: number;
};

function getAttributeLabel(credential: ModularCredential): string {
  const subject = credential.credentialSubject as Record<string, unknown> | undefined;

  return (
    (typeof subject?.nama === 'string' ? subject.nama : undefined) ||
    (typeof subject?.fullName === 'string' ? subject.fullName : undefined) ||
    (typeof subject?.attributeName === 'string' ? subject.attributeName : undefined) ||
    credential.documentName ||
    credential.id ||
    'Credential'
  );
}

function getProofJwt(credential: ModularCredential): string | undefined {
  const proof = credential.proof as any;

  if (!proof || typeof proof !== 'object') {
    return undefined;
  }

  if (isJwtString(proof.jwt)) {
    return proof.jwt.trim();
  }

  if (isJwtString(proof.jws)) {
    return proof.jws.trim();
  }

  return undefined;
}

function extractCredentialJWT(credential: ModularCredential): string {
  const rawCredential = (credential as any)?.rawCredential;

  const candidates = [
    credential.jwt,
    (credential as any)?.securedCredential,
    getProofJwt(credential),
    (credential as any)?.vcJwt,
    rawCredential?.jwt,
    rawCredential?.securedCredential,
    rawCredential?.proof?.jwt,
  ];

  const found = candidates.find((candidate) => isJwtString(candidate));

  if (!found) {
    throw new Error(
      `Credential ${getAttributeLabel(
        credential
      )} tidak memiliki VC JWT valid. Buat ulang credential sebagai VC JWT.`
    );
  }

  return found.trim();
}

export async function createSignedPresentationJWT(params: {
  holderDid: string;
  credentials: ModularCredential[];
}): Promise<SignedPresentationJWT> {
  if (!params.holderDid?.startsWith('did:key:')) {
    throw new Error('Holder DID harus did:key.');
  }

  if (!Array.isArray(params.credentials) || params.credentials.length === 0) {
    throw new Error('Pilih minimal 1 credential.');
  }

  try {
    const credentialJWTs = params.credentials.map(extractCredentialJWT);

    for (const jwt of credentialJWTs) {
      if (!isJwtString(jwt)) {
        throw new Error('Ada credential yang bukan VC JWT valid.');
      }
    }

    const jwt = await signVpJwtWithWallet({
      holderDid: params.holderDid,
      vp: {
        '@context': [VC_V2_CONTEXT],
        type: ['VerifiablePresentation'],
        holder: params.holderDid,
        verifiableCredential: credentialJWTs,
      },
    });

    if (!isJwtString(jwt)) {
      throw new Error('Presentation tidak menghasilkan VP JWT valid.');
    }

    return {
      jwt: jwt.trim(),
      holderDid: params.holderDid,
      credentialCount: credentialJWTs.length,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Gagal membuat VP JWT.';

    safeLogger.warn('Failed to create signed VP JWT', { message });

    throw new Error(`Gagal membuat VP JWT signed. Detail: ${message}`);
  }
}