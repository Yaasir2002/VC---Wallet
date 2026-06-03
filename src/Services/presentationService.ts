import { ModularCredential } from '../types/vc';
import { isJwtString, signVpJwtWithWallet } from './walletJwtSigner';
import { safeLogger } from '../utils/safeLogger';

export type SignedPresentationJWT = {
  jwt: string;
  holderDid: string;
  credentialCount: number;
};

function extractCredentialJWT(credential: ModularCredential): string {
  const candidates = [
    credential.jwt,
    credential.proof?.jwt,
    credential.proof?.jws,
    (credential as any)?.vcJwt,
    (credential as any)?.rawCredential,
    (credential as any)?.rawCredential?.jwt,
  ];

  const found = candidates.find(isJwtString);

  if (!found) {
    throw new Error(
      `Credential ${
        credential.credentialSubject?.attributeName || credential.id
      } tidak memiliki VC JWT valid. Hapus credential lama dan buat ulang.`
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

  if (params.credentials.length === 0) {
    throw new Error('Pilih minimal 1 atribut credential.');
  }

  try {
    const credentialJWTs = params.credentials.map(extractCredentialJWT);

    const jwt = await signVpJwtWithWallet({
      holderDid: params.holderDid,
      verifiableCredential: credentialJWTs,
    });

    if (!isJwtString(jwt)) {
      throw new Error('Presentation tidak menghasilkan VP JWT valid.');
    }

    return {
      jwt,
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