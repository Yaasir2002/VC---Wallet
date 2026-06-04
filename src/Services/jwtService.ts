import { createJWT } from 'did-jwt';

import { MAX_PRESENTATION_QR_BYTES } from '../config/securityLimits';
import { VerifiableCredentialV2 } from '../types/vc';
import { getWalletSigner } from './walletSigner';

function byteLength(value: string): number {
  try {
    return new TextEncoder().encode(value).length;
  } catch {
    return value.length;
  }
}

export function createJwtPayloadFromCredential(
  credential: VerifiableCredentialV2
): Record<string, unknown> {
  return {
    '@context': credential['@context'],
    type: credential.type,
    id: credential.id,
    issuer: credential.issuer,
    issuanceDate: credential.issuanceDate,
    credentialSubject: credential.credentialSubject,
  };
}

export async function createCredentialJwt(
  credential: VerifiableCredentialV2
): Promise<string> {
  const wallet = await getWalletSigner();

  const payload = createJwtPayloadFromCredential({
    ...credential,
    issuer: typeof credential.issuer === 'string' ? credential.issuer : wallet.did,
  });

  const jwt = await createJWT(payload, {
    issuer: wallet.did,
    signer: wallet.signer,
    alg: wallet.alg,
    header: {
      alg: wallet.alg,
      iss: wallet.did,
      kid: wallet.kid,
    } as any,
  } as any);

  if (!jwt || jwt.split('.').length !== 3) {
    throw new Error('JWT hasil signing tidak valid.');
  }

  return jwt.trim();
}

export async function createPresentationQrJwt(
  credential: VerifiableCredentialV2
): Promise<string> {
  const jwt = await createCredentialJwt(credential);

  if (byteLength(jwt) > MAX_PRESENTATION_QR_BYTES) {
    throw new Error('Payload QR terlalu besar.');
  }

  return jwt;
}