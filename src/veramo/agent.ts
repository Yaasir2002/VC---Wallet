export type VeramoKey = {
  kid: string;
  kms: string;
  type?: string;
  publicKeyHex?: string;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
};

export type VeramoIdentifier = {
  did: string;
  provider: string;
  alias?: string;
  controllerKeyId?: string;
  keys?: VeramoKey[];
  services?: unknown[];
  [key: string]: unknown;
};

export type DidManagerCreateArgs = {
  provider?: string;
  alias?: string;
  kms?: string;
  options?: {
    keyType?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type VeramoLikeAgent = {
  didManagerCreate: (
    args?: DidManagerCreateArgs
  ) => Promise<VeramoIdentifier>;
  didManagerGet: (...args: unknown[]) => Promise<VeramoIdentifier>;
  didManagerFind: (...args: unknown[]) => Promise<VeramoIdentifier[]>;
  keyManagerCreate: (...args: unknown[]) => Promise<VeramoKey>;
  keyManagerGet: (...args: unknown[]) => Promise<VeramoKey>;
  keyManagerFind: (...args: unknown[]) => Promise<VeramoKey[]>;
  createVerifiableCredential: (...args: unknown[]) => Promise<never>;
  verifyCredential: (...args: unknown[]) => Promise<never>;
  createVerifiablePresentation: (...args: unknown[]) => Promise<never>;
  verifyPresentation: (...args: unknown[]) => Promise<never>;
  resolveDid: (...args: unknown[]) => Promise<never>;
  [key: string]: unknown;
};

const MEMORY_IDENTIFIERS: VeramoIdentifier[] = [];

function createVeramoDisabledError(): Error {
  return new Error(
    'Veramo credential plugin dinonaktifkan untuk mengurangi dependency mobile bundle. Gunakan service wallet did:key yang sudah ada di src/Services.'
  );
}

function createPseudoDidKey(alias?: string): VeramoIdentifier {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2);
  const suffix = `${timestamp}${random}`;
  const did = `did:key:z${suffix}`;
  const controllerKeyId = `${did}#z${suffix}`;

  return {
    did,
    provider: 'did:key',
    alias,
    controllerKeyId,
    keys: [
      {
        kid: controllerKeyId,
        kms: 'local',
        type: 'Ed25519',
      },
    ],
    services: [],
  };
}

async function didManagerCreate(
  args?: DidManagerCreateArgs
): Promise<VeramoIdentifier> {
  const identifier = createPseudoDidKey(args?.alias);

  MEMORY_IDENTIFIERS.push(identifier);

  return identifier;
}

async function didManagerFind(): Promise<VeramoIdentifier[]> {
  return [...MEMORY_IDENTIFIERS];
}

async function didManagerGet(): Promise<VeramoIdentifier> {
  const identifier = MEMORY_IDENTIFIERS[0];

  if (!identifier) {
    throw new Error('DID Veramo tidak ditemukan.');
  }

  return identifier;
}

async function keyManagerCreate(): Promise<VeramoKey> {
  const identifier = MEMORY_IDENTIFIERS[0] || createPseudoDidKey('default-key');

  if (MEMORY_IDENTIFIERS.length === 0) {
    MEMORY_IDENTIFIERS.push(identifier);
  }

  return {
    kid: identifier.controllerKeyId || `${identifier.did}#key-1`,
    kms: 'local',
    type: 'Ed25519',
  };
}

async function keyManagerGet(): Promise<VeramoKey> {
  const identifier = MEMORY_IDENTIFIERS[0];

  if (!identifier?.keys?.[0]) {
    throw new Error('Key Veramo tidak ditemukan.');
  }

  return identifier.keys[0];
}

async function keyManagerFind(): Promise<VeramoKey[]> {
  return MEMORY_IDENTIFIERS.flatMap((identifier) => identifier.keys || []);
}

async function disabledCredentialMethod(): Promise<never> {
  throw createVeramoDisabledError();
}

export const agent: VeramoLikeAgent = {
  didManagerCreate,
  didManagerGet,
  didManagerFind,
  keyManagerCreate,
  keyManagerGet,
  keyManagerFind,
  createVerifiableCredential: disabledCredentialMethod,
  verifyCredential: disabledCredentialMethod,
  createVerifiablePresentation: disabledCredentialMethod,
  verifyPresentation: disabledCredentialMethod,
  resolveDid: disabledCredentialMethod,
};

export default agent;