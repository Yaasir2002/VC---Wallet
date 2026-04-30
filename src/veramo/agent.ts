import { createAgent } from '@veramo/core';
import { DIDManager, MemoryDIDStore } from '@veramo/did-manager';
import { KeyManager, MemoryKeyStore, MemoryPrivateKeyStore } from '@veramo/key-manager';
import { KeyManagementSystem } from '@veramo/kms-local';
import { EthrDIDProvider } from '@veramo/did-provider-ethr';
import { DIDResolverPlugin } from '@veramo/did-resolver';
import { CredentialPlugin } from '@veramo/credential-w3c';
import { Resolver } from 'did-resolver';
import { getResolver as getEthrResolver } from 'ethr-did-resolver';

const INFURA_PROJECT_ID = 'ISI_INFURA_PROJECT_ID_KAMU';

const networks = [
  {
    name: 'sepolia',
    chainId: 11155111,
    rpcUrl: `https://sepolia.infura.io/v3/${INFURA_PROJECT_ID}`,
  },
];

export const agent = createAgent({
  plugins: [
    new KeyManager({
      store: new MemoryKeyStore(),
      kms: {
        local: new KeyManagementSystem(new MemoryPrivateKeyStore()),
      },
    }),

    new DIDManager({
      store: new MemoryDIDStore(),
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

    new CredentialPlugin(),
  ],
});