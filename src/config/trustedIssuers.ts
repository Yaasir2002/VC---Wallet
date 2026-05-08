export type TrustedIssuer = {
  id: string;
  name: string;
  allowedCredentialTypes: string[];
  status: 'active' | 'inactive';
};

export const TRUSTED_ISSUERS: TrustedIssuer[] = [
  /**
   * GANTI dengan issuer DID resmi project Anda.
   *
   * Contoh production:
   * {
   *   id: 'did:web:issuer.example.edu',
   *   name: 'Example University',
   *   allowedCredentialTypes: [
   *     'VerifiableCredential',
   *     'StudentCredential',
   *     'KtmCredential',
   *   ],
   *   status: 'active',
   * }
   */
  {
    id: 'did:web:example.edu',
    name: 'Example University',
    allowedCredentialTypes: [
      'VerifiableCredential',
      'StudentCredential',
      'KtmCredential',
    ],
    status: 'inactive',
  },
];