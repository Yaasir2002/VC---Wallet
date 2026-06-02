import { agent } from '../veramo/agent';
import { safeLogger } from '../utils/safeLogger';

const ISSUER_ALIAS = 'main-issuer';

function assertDidKeyIdentifier(identifier: any): string {
  const did = identifier?.did;

  if (!did || typeof did !== 'string') {
    throw new Error('Identifier Veramo tidak memiliki DID.');
  }

  if (!did.startsWith('did:key:')) {
    throw new Error(`Issuer DID harus did:key. DID saat ini: ${did}`);
  }

  return did;
}

function hasUsableKey(identifier: any): boolean {
  const keys = Array.isArray(identifier?.keys) ? identifier.keys : [];

  return keys.some((key: any) => {
    return (
      typeof key?.kid === 'string' &&
      typeof key?.kms === 'string' &&
      key.kms === 'local'
    );
  });
}

export async function getOrCreateVeramoIssuerDid(): Promise<string> {
  try {
    const identifiers = await agent.didManagerFind();

    const existingByAlias = identifiers.find((identifier: any) => {
      return identifier?.alias === ISSUER_ALIAS && hasUsableKey(identifier);
    });

    if (existingByAlias) {
      return assertDidKeyIdentifier(existingByAlias);
    }

    const existingDidKey = identifiers.find((identifier: any) => {
      return (
        typeof identifier?.did === 'string' &&
        identifier.did.startsWith('did:key:') &&
        hasUsableKey(identifier)
      );
    });

    if (existingDidKey) {
      return assertDidKeyIdentifier(existingDidKey);
    }

    const created = await agent.didManagerCreate({
      provider: 'did:key',
      alias: ISSUER_ALIAS,
      kms: 'local',
      options: {
        keyType: 'Ed25519',
      },
    });

    return assertDidKeyIdentifier(created);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Gagal membuat issuer DID Veramo.';

    safeLogger.error('Failed to get or create Veramo issuer DID', { message });

    throw new Error(
      `Gagal menyiapkan issuer DID Veramo untuk signing. Detail: ${message}`
    );
  }
}