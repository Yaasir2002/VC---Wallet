// File: src/Services/jwtSignatureVerifier.ts

import nacl from 'tweetnacl';
import { p256 } from '@noble/curves/p256';
import { sha256 } from '@noble/hashes/sha256';

import { JwtHeader } from '../types/jwt';
import { base64UrlToBuffer, utf8ToBytes } from '../utils/base64url';
import { SupportedPublicKeyJwk } from './didWebResolver';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isP256Jwk(jwk: SupportedPublicKeyJwk): boolean {
  return (
    isRecord(jwk) &&
    jwk.kty === 'EC' &&
    jwk.crv === 'P-256' &&
    typeof jwk.x === 'string' &&
    typeof jwk.y === 'string'
  );
}

function isEd25519Jwk(jwk: SupportedPublicKeyJwk): boolean {
  return (
    isRecord(jwk) &&
    jwk.kty === 'OKP' &&
    jwk.crv === 'Ed25519' &&
    typeof jwk.x === 'string'
  );
}

function toUint8Array(value: Uint8Array | ArrayBuffer | ArrayBufferView): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

function base64UrlToUint8Array(value: string): Uint8Array {
  return toUint8Array(base64UrlToBuffer(value));
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const length = arrays.reduce((total, item) => total + item.length, 0);
  const result = new Uint8Array(length);

  let offset = 0;

  for (const item of arrays) {
    result.set(item, offset);
    offset += item.length;
  }

  return result;
}

function rawJoseSignatureToDer(signature: Uint8Array): Uint8Array {
  if (signature.length !== 64) {
    throw new Error('invalid_signature');
  }

  const r = signature.slice(0, 32);
  const s = signature.slice(32, 64);

  function trimInteger(bytes: Uint8Array): Uint8Array {
    let start = 0;

    while (start < bytes.length - 1 && bytes[start] === 0) {
      start += 1;
    }

    let value = bytes.slice(start);

    if (value[0] & 0x80) {
      value = concatBytes(new Uint8Array([0]), value);
    }

    return value;
  }

  const rTrimmed = trimInteger(r);
  const sTrimmed = trimInteger(s);
  const sequenceLength = 2 + rTrimmed.length + 2 + sTrimmed.length;

  return concatBytes(
    new Uint8Array([0x30, sequenceLength]),
    new Uint8Array([0x02, rTrimmed.length]),
    rTrimmed,
    new Uint8Array([0x02, sTrimmed.length]),
    sTrimmed
  );
}

function getP256PublicKeyUncompressed(jwk: SupportedPublicKeyJwk): Uint8Array {
  if (!isP256Jwk(jwk)) {
    throw new Error('unsupported_public_key');
  }

  const x = base64UrlToUint8Array(jwk.x);
  const y = base64UrlToUint8Array(jwk.y);

  if (x.length !== 32 || y.length !== 32) {
    throw new Error('unsupported_public_key');
  }

  return concatBytes(new Uint8Array([0x04]), x, y);
}

async function verifyEs256JwtSignature(params: {
  encodedSignature: string;
  signingInput: string;
  publicKeyJwk: SupportedPublicKeyJwk;
}): Promise<boolean> {
  if (!isP256Jwk(params.publicKeyJwk)) {
    throw new Error('unsupported_public_key');
  }

  const rawSignature = base64UrlToUint8Array(params.encodedSignature);
  const message = utf8ToBytes(params.signingInput);
  const digest = sha256(message);
  const publicKey = getP256PublicKeyUncompressed(params.publicKeyJwk);

  if (rawSignature.length !== 64) {
    throw new Error('invalid_signature');
  }

  try {
    const derSignature = rawJoseSignatureToDer(rawSignature);

    if (p256.verify(derSignature, digest, publicKey)) {
      return true;
    }
  } catch {
    // fallback raw di bawah
  }

  try {
    return p256.verify(rawSignature, digest, publicKey);
  } catch {
    return false;
  }
}

async function verifyEdDsaJwtSignature(params: {
  encodedSignature: string;
  signingInput: string;
  publicKeyJwk: SupportedPublicKeyJwk;
}): Promise<boolean> {
  if (!isEd25519Jwk(params.publicKeyJwk)) {
    throw new Error('unsupported_public_key');
  }

  const signature = base64UrlToUint8Array(params.encodedSignature);
  const publicKey = base64UrlToUint8Array(params.publicKeyJwk.x);
  const message = utf8ToBytes(params.signingInput);

  if (signature.length !== 64) {
    throw new Error('invalid_signature');
  }

  if (publicKey.length !== 32) {
    throw new Error('unsupported_public_key');
  }

  try {
    return nacl.sign.detached.verify(message, signature, publicKey);
  } catch {
    return false;
  }
}

export async function verifyJwtSignature(params: {
  header: JwtHeader;
  encodedSignature: string;
  signingInput: string;
  publicKeyJwk: SupportedPublicKeyJwk;
}): Promise<boolean> {
  if (params.header.alg === 'ES256') {
    return verifyEs256JwtSignature({
      encodedSignature: params.encodedSignature,
      signingInput: params.signingInput,
      publicKeyJwk: params.publicKeyJwk,
    });
  }

  if (params.header.alg === 'EdDSA') {
    return verifyEdDsaJwtSignature({
      encodedSignature: params.encodedSignature,
      signingInput: params.signingInput,
      publicKeyJwk: params.publicKeyJwk,
    });
  }

  throw new Error('unsupported_algorithm');
}