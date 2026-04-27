import { VerifiableCredential } from '../types/vc';
import { VerifiablePresentation } from '../types/vp';

export function generateVP(
  credential: VerifiableCredential,
  holderDID: string
): VerifiablePresentation {
  return {
    id: `vp-${Date.now()}`,
    type: ['VerifiablePresentation'],
    holder: holderDID,
    createdAt: new Date().toISOString(),
    verifiableCredential: credential,
  };
}