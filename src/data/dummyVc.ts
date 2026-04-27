import { VerifiableCredential } from '../types/vc';

export const dummyKtpVC: VerifiableCredential = {
  id: `vc-ktp-${Date.now()}`,
  type: ['VerifiableCredential', 'IdentityCredential'],
  issuer: 'did:example:issuer-government',
  issuanceDate: new Date().toISOString(),
  credentialSubject: {
    id: 'did:example:user',
    name: 'Nama Pengguna',
    nik: '3276XXXXXXXXXXXX',
    birthDate: '2001-01-01',
    address: 'Indonesia',
  },
  proof: {
    type: 'Ed25519Signature2020',
    created: new Date().toISOString(),
    proofPurpose: 'assertionMethod',
    verificationMethod: 'did:example:issuer-government#key-1',
    jws: 'dummy-signature-for-development',
  },
};