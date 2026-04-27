import { VerifiableCredential } from './vc';

export interface VerifiablePresentation {
  id: string;
  type: string[];
  holder: string;
  createdAt: string;
  verifiableCredential: VerifiableCredential;
}