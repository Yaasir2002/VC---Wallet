export type TrustedIssuer = {
  id: string;
  name: string;
  allowedCredentialTypes: string[];
  status: 'active' | 'inactive';
};

export const TRUSTED_ISSUERS: TrustedIssuer[] = [
  {
    id: 'did:example:issuer-government',
    name: 'Government Example Issuer',
    allowedCredentialTypes: ['VerifiableCredential', 'IdentityCredential', 'KtpCredential'],
    status: 'active',
  },
  {
    id: 'did:example:issuer-university',
    name: 'University Example Issuer',
    allowedCredentialTypes: ['VerifiableCredential', 'StudentCredential', 'KtmCredential'],
    status: 'active',
  },
];