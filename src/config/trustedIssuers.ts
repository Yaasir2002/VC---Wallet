export type TrustedIssuer = {
  id: string;
  name: string;
  allowedCredentialTypes: string[];
  status: 'active' | 'inactive';
};

export const TRUSTED_ISSUERS: TrustedIssuer[] = [
  {
    id: 'did:web:vc-issuer.yaasir.dev',
    name: 'VC Issuer Yaasir',
    allowedCredentialTypes: [
      'VerifiableCredential',
      'IdentityCredential',
      'StudentCredential',
      'KtpCredential',
      'KtmCredential',
      'CustomCredential',
    ],
    status: 'active',
  },
];