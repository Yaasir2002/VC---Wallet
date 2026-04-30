import { agent } from '../veramo/agent';

export async function resolveDID(did: string) {
  const result = await agent.resolveDid({
    didUrl: did,
  });

  return result;
}

export async function verifyCredentialJWT(jwt: string) {
  const result = await agent.verifyCredential({
    credential: jwt,
  });

  return result;
}

export async function verifyPresentationJWT(jwt: string) {
  const result = await agent.verifyPresentation({
    presentation: jwt,
  });

  return result;
}

export async function verifyJWTWithDIDResolution(jwt: string) {
  const verification = await verifyPresentationJWT(jwt);

  const holder =
    verification?.verified === true
      ? verification
      : null;

  return {
    verified: verification.verified,
    verification,
    holder,
  };
}