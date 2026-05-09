import { createAgent } from '@veramo/core';
import { DIDManager } from '@veramo/did-manager';
import { KeyManager } from '@veramo/key-manager';
import { KeyManagementSystem } from '@veramo/kms-local';
import { EthrDIDProvider } from '@veramo/did-provider-ethr';
import { DIDResolverPlugin } from '@veramo/did-resolver';
import { CredentialPlugin } from '@veramo/credential-w3c';
import { Resolver } from 'did-resolver';
import { getResolver as getEthrResolver } from 'ethr-did-resolver';

import { SecurePrivateKeyStore } from './securePrivateKeyStore';
import { SecureKeyStore } from './secureKeyStore';
import { SecureDIDStore } from './secureDIDStore';

const networks = [
  {
    name: 'sepolia',
    chainId: 11155111,
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
  },
];

/**
 * Veramo agent configured for persistent storage.
 *
 * Key changes from the previous MemoryKeyStore/MemoryDIDStore setup:
 * - SecureKeyStore: persists key metadata (kid, type, publicKeyHex) across restarts
 * - SecureDIDStore: persists DID identifier records across restarts
 * - SecurePrivateKeyStore: already persisted private key material (unchanged)
 *
 * This means the wallet's holder DID and signing keys survive app restarts.
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
      defaultProvider: 'did:ethr:sepolia',
      providers: {
        'did:ethr:sepolia': new EthrDIDProvider({
          defaultKms: 'local',
          networks,
        }),
      },
    }),

    new DIDResolverPlugin({
      resolver: new Resolver({
        ...getEthrResolver({
          networks,
        }),
      }),
    }),

    new CredentialPlugin([]),
  ],
});