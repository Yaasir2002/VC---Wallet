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

/**
 * Veramo agent configured for persistent, offline-first storage.
 *
 * Uses did:key instead of did:ethr:
 * - did:key is derived entirely from the public key — no blockchain or network needed
 * - did:ethr requires a live RPC call to Sepolia which can fail on poor networks
 *
 * Storage:
 * - SecureKeyStore: persists key metadata (kid, type, publicKeyHex) across restarts
 * - SecureDIDStore: persists DID identifier records across restarts
 * - SecurePrivateKeyStore: persists private key material in expo-secure-store
 */
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
        'did:key': new KeyDIDProvider({ defaultKms: 'local' }),
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