import { createAgent } from '@veramo/core';
import { DIDManager } from '@veramo/did-manager';
import { KeyManager } from '@veramo/key-manager';
import { KeyManagementSystem } from '@veramo/kms-local';
import { KeyDIDProvider } from '@veramo/did-provider-key';
import { DIDResolverPlugin } from '@veramo/did-resolver';
import { CredentialPlugin } from '@veramo/credential-w3c';
import { Resolver } from 'did-resolver';
import { getResolver as getKeyResolver } from 'key-did-resolver';

import { SecurePrivateKeyStore } from './securePrivateKeyStore';
import { SecureKeyStore } from './secureKeyStore';
import { SecureDIDStore } from './secureDIDStore';

export const agent = createAgent({
  plugins: [
    new KeyManager({
      store: new SecureKeyStore() as any,
      kms: {
        local: new KeyManagementSystem(new SecurePrivateKeyStore() as any),
      },
    }),

    new DIDManager({
      store: new SecureDIDStore() as any,
      defaultProvider: 'did:key',
      providers: {
        'did:key': new KeyDIDProvider({
          defaultKms: 'local',
        }),
      },
    }),

    new DIDResolverPlugin({
      resolver: new Resolver({
        ...getKeyResolver(),
      }),
    }),

    new CredentialPlugin([]),
  ],
});