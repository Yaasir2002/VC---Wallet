export type TrustedIssuer = {
  id: string;
  name: string;
  allowedCredentialTypes: string[];
  status: 'active' | 'inactive';
};

export const TRUSTED_ISSUERS: TrustedIssuer[] = [
  {
    id: 'did:web:identitylab.id',
    name: 'IdentityLab Demo Issuer',
    allowedCredentialTypes: [
      'VerifiableCredential',
      'AcademicCredential',
      'IdentityCredential',
      'StudentCredential',
      'KtpCredential',
      'KtmCredential',
      'CustomCredential',
    ],
    status: 'active',
  },
  {
    id: 'did:web:demo.identitylab.id',
    name: 'IdentityLab Demo Subdomain Issuer',
    allowedCredentialTypes: [
      'VerifiableCredential',
      'AcademicCredential',
      'IdentityCredential',
      'StudentCredential',
      'KtpCredential',
      'KtmCredential',
      'CustomCredential',
    ],
    status: 'active',
  },
  {
    id: 'did:web:vc-issuer.yaasir.dev',
    name: 'VC Issuer Yaasir',
    allowedCredentialTypes: [
      'VerifiableCredential',
      'AcademicCredential',
      'IdentityCredential',
      'StudentCredential',
      'KtpCredential',
      'KtmCredential',
      'CustomCredential',
    ],
    status: 'active',
  },
];