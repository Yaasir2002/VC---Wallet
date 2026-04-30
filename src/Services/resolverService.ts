import { agent } from '../veramo/agent';

export async function resolveDID(did: string) {
  if (!did) {
    throw new Error('DID tidak boleh kosong');
  }

  const result = await agent.resolveDid({
    didUrl: did,
  });

  return result;
}

export function extractPublicKeyInfo(didResolutionResult: any) {
  const didDocument = didResolutionResult?.didDocument;

  return {
    didDocument,
    verificationMethod: didDocument?.verificationMethod || [],
    authentication: didDocument?.authentication || [],
    assertionMethod: didDocument?.assertionMethod || [],
  };
}