import { Resolver } from 'did-resolver';
import { getResolver as getEthrResolver } from 'ethr-did-resolver';

export type DIDDocument = {
  id: string;
  verificationMethod?: VerificationMethod[];
  publicKey?: VerificationMethod[];
  assertionMethod?: (string | VerificationMethod)[];
  authentication?: (string | VerificationMethod)[];
  capabilityInvocation?: (string | VerificationMethod)[];
  capabilityDelegation?: (string | VerificationMethod)[];
  keyAgreement?: (string | VerificationMethod)[];
  [key: string]: unknown;
};

export type VerificationMethod = {
  id: string;
  type?: string;
  controller?: string;
  publicKeyJwk?: JsonWebKey;
  publicKeyMultibase?: string;
  publicKeyBase58?: string;
  publicKeyPem?: string;
  blockchainAccountId?: string;
  ethereumAddress?: string;
  [key: string]: unknown;
};

export type DIDResolutionResult = {
  did: string;
  didDocument: DIDDocument | null;
  error?: string;
};

const REQUEST_TIMEOUT_MS = 10000;

function isDid(value: string): boolean {
  return /^did:[a-z0-9]+:.+/i.test(value);
}

function getDidMethod(did: string): string | null {
  const match = did.match(/^did:([a-z0-9]+):/i);
  return match?.[1] ?? null;
}

function didWebToUrl(did: string): string {
  const withoutPrefix = did.replace(/^did:web:/, '');
  const parts = withoutPrefix.split(':').map(decodeURIComponent);

  if (parts.length === 0 || !parts[0]) {
    throw new Error('did:web tidak valid');
  }

  const host = parts[0];
  const pathParts = parts.slice(1);

  if (pathParts.length === 0) {
    return `https://${host}/.well-known/did.json`;
  }

  return `https://${host}/${pathParts.join('/')}/did.json`;
}

async function fetchJsonWithTimeout(url: string): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/did+json, application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`DID document gagal diambil: ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function resolveDidWeb(did: string): Promise<DIDResolutionResult> {
  try {
    const url = didWebToUrl(did);
    const didDocument = await fetchJsonWithTimeout(url);

    if (!didDocument || didDocument.id !== did) {
      return {
        did,
        didDocument: null,
        error: 'DID document did:web tidak cocok dengan DID issuer',
      };
    }

    return {
      did,
      didDocument,
    };
  } catch (error) {
    return {
      did,
      didDocument: null,
      error:
        error instanceof Error
          ? error.message
          : 'Gagal resolve did:web',
    };
  }
}

async function resolveDidEthr(did: string): Promise<DIDResolutionResult> {
  try {
    const resolver = new Resolver({
          ...getEthrResolver({
            networks: [
              {
                name: 'mainnet',
                rpcUrl: 'https://cloudflare-eth.com',
              },
            ],
          }),
        });

    const result = await resolver.resolve(did);

    if (result.didResolutionMetadata?.error) {
      return {
        did,
        didDocument: null,
        error: String(result.didResolutionMetadata.error),
      };
    }

    return {
      did,
      didDocument: (result.didDocument as DIDDocument) ?? null,
      error: result.didDocument ? undefined : 'DID document tidak ditemukan',
    };
  } catch (error) {
    return {
      did,
      didDocument: null,
      error:
        error instanceof Error
          ? error.message
          : 'Gagal resolve did:ethr',
    };
  }
}

function resolveDidExample(did: string): DIDResolutionResult {
  return {
    did,
    didDocument: null,
    error:
      'did:example hanya untuk dokumentasi/development dan tidak di-resolve sebagai DID production',
  };
}

export async function resolveDid(did: string): Promise<DIDResolutionResult> {
  if (!did || !isDid(did)) {
    return {
      did,
      didDocument: null,
      error: 'Issuer bukan DID yang valid',
    };
  }

  const method = getDidMethod(did);

  if (method === 'web') {
    return resolveDidWeb(did);
  }

  if (method === 'ethr') {
    return resolveDidEthr(did);
  }

  if (method === 'example') {
    return resolveDidExample(did);
  }

  return {
    did,
    didDocument: null,
    error: `DID method belum didukung: ${method}`,
  };
}

export function getAllVerificationMethods(
  didDocument: DIDDocument
): VerificationMethod[] {
  const directMethods = [
    ...(didDocument.verificationMethod ?? []),
    ...(didDocument.publicKey ?? []),
  ];

  const embeddedAssertionMethods = (didDocument.assertionMethod ?? []).filter(
    (item): item is VerificationMethod =>
      typeof item === 'object' && item !== null && 'id' in item
  );

  const embeddedAuthenticationMethods = (didDocument.authentication ?? []).filter(
    (item): item is VerificationMethod =>
      typeof item === 'object' && item !== null && 'id' in item
  );

  return [
    ...directMethods,
    ...embeddedAssertionMethods,
    ...embeddedAuthenticationMethods,
  ];
}

export function getAllowedVerificationMethodIds(
  didDocument: DIDDocument
): Set<string> {
  const ids = new Set<string>();

  for (const item of didDocument.assertionMethod ?? []) {
    if (typeof item === 'string') {
      ids.add(item);
    } else if (item?.id) {
      ids.add(item.id);
    }
  }

  for (const item of didDocument.authentication ?? []) {
    if (typeof item === 'string') {
      ids.add(item);
    } else if (item?.id) {
      ids.add(item.id);
    }
  }

  for (const method of getAllVerificationMethods(didDocument)) {
    if (method.id) {
      ids.add(method.id);
    }
  }

  return ids;
}

export function findVerificationMethod(
  didDocument: DIDDocument,
  verificationMethodId?: string | null
): VerificationMethod | null {
  const methods = getAllVerificationMethods(didDocument);

  if (!verificationMethodId) {
    const assertion = didDocument.assertionMethod?.[0];

    if (typeof assertion === 'string') {
      return methods.find((method) => method.id === assertion) ?? null;
    }

    if (assertion && typeof assertion === 'object') {
      return assertion;
    }

    return methods[0] ?? null;
  }

  const normalizedId = verificationMethodId.includes('#')
    ? verificationMethodId
    : `${didDocument.id}#${verificationMethodId}`;

  return (
    methods.find((method) => method.id === verificationMethodId) ??
    methods.find((method) => method.id === normalizedId) ??
    methods.find((method) => method.id.endsWith(`#${verificationMethodId}`)) ??
    null
  );
}