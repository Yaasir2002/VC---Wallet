import { agent } from '../veramo/agent';
import { ModularCredential } from '../types/vc';

export async function createSignedPresentationJWT(params: {
  holderDid: string;
  credentials: ModularCredential[];
}) {
  const credentialJWTs = params.credentials
    .map((vc) => vc.jwt)
    .filter((jwt): jwt is string => typeof jwt === 'string' && jwt.length > 0);

  if (credentialJWTs.length === 0) {
    throw new Error(
      'Credential belum memiliki JWT. Hapus credential lama lalu buat/import credential baru dengan format JWT.'
    );
  }

  const presentation = {
    holder: params.holderDid,
    type: ['VerifiablePresentation'],
    verifiableCredential: credentialJWTs,
  };

  const vpJwt = await agent.createVerifiablePresentation({
    presentation,
    proofFormat: 'jwt',
  });

  return {
    id: `vp-${Date.now()}`,
    holder: params.holderDid,
    type: ['VerifiablePresentation'],
    createdAt: new Date().toISOString(),
    jwt: vpJwt,
  };
}