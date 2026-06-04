import { ModularCredential, SignedPresentationJWT } from '../types/vc';
import { normalizeToVcV2 } from './credentialV2Service';
import { createPresentationQrJwt } from './jwtService';
import { safeLogger } from '../utils/safeLogger';
import { isJwtString } from './walletJwtSigner';

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
    const credential = normalizeToVcV2(params.credentials[0]);

    const jwt = await createPresentationQrJwt(credential);

    if (!isJwtString(jwt)) {
      throw new Error('Presentation tidak menghasilkan JWT valid.');
    }

    return {
      jwt,
      holderDid: params.holderDid,
      credentialCount: 1,
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