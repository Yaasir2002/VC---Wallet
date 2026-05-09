import { agent } from '../veramo/agent';
import { safeLogger } from '../utils/safeLogger';

export type IdentityVCInput = {
  issuerDid: string;
  subjectDid: string;
  name?: string;
  nik?: string;
};

export const createIdentityVC = async ({
  issuerDid,
  subjectDid,
  name = 'User Wallet',
  nik = '317xxxxxxxxxxxxx',
}: IdentityVCInput) => {
  try {
    if (!issuerDid) {
      throw new Error('Issuer DID belum tersedia');
    }

    if (!subjectDid) {
      throw new Error('Subject DID belum tersedia');
    }

    const credentialPayload = {
      issuer: issuerDid,
      type: ['VerifiableCredential', 'IdentityCredential'],
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: subjectDid,
        name,
        nik,
        documentType: 'KTP',
        verificationStatus: 'Verified',
      },
    };

    const vc = await agent.createVerifiableCredential({
      credential: credentialPayload,
      proofFormat: 'jwt',
    });

    return vc;
  } catch (error) {
    safeLogger.error('Failed to create identity VC');
    throw error;
  }
};