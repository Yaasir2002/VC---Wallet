import { ModularCredential } from '../types/vc';
import { signVpJwtWithWallet, isJwtString } from './walletJwtSigner';
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
    (credential as any)?.rawCredential,
    (credential as any)?.rawCredential?.jwt,
    (credential as any)?.vcJwt,
  ];

  const found = candidates.find(isJwtString);

  if (!found) {
    throw new Error(
      `Credential ${credential.id} tidak memiliki VC JWT valid. Buat ulang credential KTP agar tersimpan sebagai signed VC JWT.`
    );
  }

  return found.trim();
}

export async function createSignedPresentationJWT(params: {
  holderDid: string;
  credentials: ModularCredential[];
}): Promise<SignedPresentationJWT> {
  if (!params.holderDid) {
    throw new Error('Holder DID belum tersedia.');
  }

  if (!params.holderDid.startsWith('did:key:')) {
    throw new Error(`Holder DID harus did:key. DID saat ini: ${params.holderDid}`);
  }

  if (!params.credentials.length) {
    throw new Error('Minimal 1 credential harus dipilih untuk presentasi.');
  }

  try {
    const credentialJWTs = params.credentials.map(extractCredentialJWT);

    const jwt = await signVpJwtWithWallet({
      holderDid: params.holderDid,
      verifiableCredential: credentialJWTs,
    });

    if (!isJwtString(jwt)) {
      throw new Error('VP JWT hasil signing tidak valid.');
    }

    return {
      jwt,
      holderDid: params.holderDid,
      credentialCount: credentialJWTs.length,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Gagal membuat signed VP JWT.';

    safeLogger.warn('Failed to create signed VP JWT', { message });

    throw new Error(`Presentation gagal ditandatangani. Detail: ${message}`);
  }
}