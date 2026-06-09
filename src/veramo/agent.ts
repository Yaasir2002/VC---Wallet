// File: src/veramo/agent.ts

import nacl from 'tweetnacl';

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
  privateKeySeedHex?: string;
  method?: string;
  network?: string;
  createdAt?: string;
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

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function createVeramoDisabledError(): Error {
  return new Error(
    'Veramo credential plugin dinonaktifkan untuk mengurangi dependency mobile bundle. Gunakan service wallet did:key yang sudah ada di src/Services.'
  );
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';

  const digits = [0];

  for (const byte of bytes) {
    let carry = byte;

    for (let i = 0; i < digits.length; i += 1) {
      const value = digits[i] * 256 + carry;
      digits[i] = value % 58;
      carry = Math.floor(value / 58);
    }

    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  let result = '';

  for (const byte of bytes) {
    if (byte === 0) {
      result += BASE58_ALPHABET[0];
    } else {
      break;
    }
  }

  for (let i = digits.length - 1; i >= 0; i -= 1) {
    result += BASE58_ALPHABET[digits[i]];
  }

  return result;
}

function concatBytes(...items: Uint8Array[]): Uint8Array {
  const length = items.reduce((total, item) => total + item.length, 0);
  const result = new Uint8Array(length);

  let offset = 0;

  for (const item of items) {
    result.set(item, offset);
    offset += item.length;
  }

  return result;
}

function createDidKeyFromPublicKey(publicKey: Uint8Array): string {
  const ed25519MulticodecPrefix = new Uint8Array([0xed, 0x01]);
  const fingerprint = base58Encode(
    concatBytes(ed25519MulticodecPrefix, publicKey)
  );

  return `did:key:z${fingerprint}`;
}

function createRealDidKey(alias?: string): VeramoIdentifier {
  const seed = nacl.randomBytes(32);
  const keyPair = nacl.sign.keyPair.fromSeed(seed);

  const did = createDidKeyFromPublicKey(keyPair.publicKey);
  const publicKeyFingerprint = did.replace('did:key:', '');
  const controllerKeyId = `${did}#${publicKeyFingerprint}`;
  const createdAt = new Date().toISOString();

  return {
    did,
    provider: 'did:key',
    alias,
    controllerKeyId,
    privateKeySeedHex: bytesToHex(seed),
    method: 'key',
    network: 'none',
    createdAt,
    keys: [
      {
        kid: controllerKeyId,
        kms: 'local',
        type: 'Ed25519',
        publicKeyHex: bytesToHex(keyPair.publicKey),
      },
    ],
    services: [],
  };
}

async function didManagerCreate(
  args?: DidManagerCreateArgs
): Promise<VeramoIdentifier> {
  const identifier = createRealDidKey(args?.alias);

  MEMORY_IDENTIFIERS.length = 0;
  MEMORY_IDENTIFIERS.push(identifier);

  return identifier;
}

async function didManagerFind(): Promise<VeramoIdentifier[]> {
  return [...MEMORY_IDENTIFIERS];
}

async function didManagerGet(): Promise<VeramoIdentifier> {
  const identifier = MEMORY_IDENTIFIERS[0];

  if (!identifier) {
    throw new Error('DID wallet tidak ditemukan.');
  }

  return identifier;
}

async function keyManagerCreate(): Promise<VeramoKey> {
  const identifier = MEMORY_IDENTIFIERS[0] || createRealDidKey('default-key');

  if (MEMORY_IDENTIFIERS.length === 0) {
    MEMORY_IDENTIFIERS.push(identifier);
  }

  return {
    kid: identifier.controllerKeyId || `${identifier.did}#key-1`,
    kms: 'local',
    type: 'Ed25519',
    publicKeyHex: identifier.keys?.[0]?.publicKeyHex,
  };
}

async function keyManagerGet(): Promise<VeramoKey> {
  const identifier = MEMORY_IDENTIFIERS[0];

  if (!identifier?.keys?.[0]) {
    throw new Error('Key wallet tidak ditemukan.');
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