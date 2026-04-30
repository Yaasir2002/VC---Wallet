import { agent } from '../veramo/agent';

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

    console.log('VERAMO ISSUER DID:', issuerDid);
    console.log('SUBJECT DID:', subjectDid);

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

    console.log('VC PAYLOAD:', JSON.stringify(credentialPayload, null, 2));

    const vc = await agent.createVerifiableCredential({
      credential: credentialPayload,
      proofFormat: 'jwt',
    });

    console.log('VC RESULT:', vc);

    return vc;
  } catch (error) {
    console.log('CREATE VC ERROR:', error);
    throw error;
  }
};