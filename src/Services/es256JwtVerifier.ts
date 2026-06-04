// File: src/services/es256JwtVerifier.ts

import { p256 } from '@noble/curves/p256';
import { sha256 } from '@noble/hashes/sha256';

import { SUPPORTED_JWT_ALG } from '../config/securityLimits';
import { JwtHeader } from '../types/jwt';
import { base64UrlToBuffer, utf8ToBytes } from '../utils/base64url';

function jwkCoordinateToBytes(value: string): Uint8Array {
  const bytes = base64UrlToBuffer(value);

  if (bytes.length !== 32) {
    throw new Error('unsupported_public_key');
  }

  return bytes;
}

function p256JwkToUncompressedPublicKey(jwk: JsonWebKey): Uint8Array {
  if (
    jwk.kty !== 'EC' ||
    jwk.crv !== 'P-256' ||
    typeof jwk.x !== 'string' ||
    typeof jwk.y !== 'string'
  ) {
    throw new Error('unsupported_public_key');
  }

  const x = jwkCoordinateToBytes(jwk.x);
  const y = jwkCoordinateToBytes(jwk.y);

  const publicKey = new Uint8Array(65);
  publicKey[0] = 0x04;
  publicKey.set(x, 1);
  publicKey.set(y, 33);

  return publicKey;
}

function assertRawEs256Signature(signature: Uint8Array): void {
  if (signature.length !== 64) {
    throw new Error('invalid_signature');
  }
}

export function verifyEs256JwtSignature(params: {
  header: JwtHeader;
  encodedSignature: string;
  signingInput: string;
  publicKeyJwk: JsonWebKey;
}): boolean {
  if (params.header.alg !== SUPPORTED_JWT_ALG) {
    throw new Error('unsupported_algorithm');
  }

  const signature = base64UrlToBuffer(params.encodedSignature);
  assertRawEs256Signature(signature);

  const publicKey = p256JwkToUncompressedPublicKey(params.publicKeyJwk);
  const messageHash = sha256(utf8ToBytes(params.signingInput));

  try {
    return p256.verify(signature, messageHash, publicKey);
  } catch {
    return false;
  }
}