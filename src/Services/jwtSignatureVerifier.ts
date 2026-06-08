// File: src/Services/jwtSignatureVerifier.ts

import * as ed25519 from '@noble/ed25519';

import { JwtHeader } from '../types/jwt';
import { base64UrlToBuffer, utf8ToBytes } from '../utils/base64url';
import { SupportedPublicKeyJwk } from './didWebResolver';

function isP256Jwk(jwk: SupportedPublicKeyJwk): boolean {
  return (
    jwk.kty === 'EC' &&
    jwk.crv === 'P-256' &&
    typeof jwk.x === 'string' &&
    typeof jwk.y === 'string'
  );
}

function isEd25519Jwk(jwk: SupportedPublicKeyJwk): boolean {
  return (
    jwk.kty === 'OKP' &&
    jwk.crv === 'Ed25519' &&
    typeof jwk.x === 'string'
  );
}

function getSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;

  if (!subtle) {
    throw new Error('crypto_subtle_not_available');
  }

  return subtle;
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(value.byteLength);
  const view = new Uint8Array(buffer);

  view.set(value);

  return buffer;
}

function jwtEcdsaSignatureToDer(rawSignature: Uint8Array): Uint8Array {
  if (rawSignature.length !== 64) {
    throw new Error('invalid_signature');
  }

  const r = rawSignature.slice(0, 32);
  const s = rawSignature.slice(32, 64);

  function trimLeadingZeroes(bytes: Uint8Array): Uint8Array {
    let index = 0;

    while (index < bytes.length - 1 && bytes[index] === 0) {
      index += 1;
    }

    return bytes.slice(index);
  }

  function encodeInteger(bytes: Uint8Array): Uint8Array {
    const trimmed = trimLeadingZeroes(bytes);
    const needsPadding = (trimmed[0] & 0x80) !== 0;
    const value = needsPadding
      ? new Uint8Array([0, ...Array.from(trimmed)])
      : trimmed;

    return new Uint8Array([0x02, value.length, ...Array.from(value)]);
  }

  const encodedR = encodeInteger(r);
  const encodedS = encodeInteger(s);
  const sequenceLength = encodedR.length + encodedS.length;

  return new Uint8Array([
    0x30,
    sequenceLength,
    ...Array.from(encodedR),
    ...Array.from(encodedS),
  ]);
}

async function verifyEs256JwtSignature(params: {
  encodedSignature: string;
  signingInput: string;
  publicKeyJwk: SupportedPublicKeyJwk;
}): Promise<boolean> {
  if (!isP256Jwk(params.publicKeyJwk)) {
    throw new Error('unsupported_public_key');
  }

  const signature = base64UrlToBuffer(params.encodedSignature);
  const message = utf8ToBytes(params.signingInput);
  const subtle = getSubtleCrypto();

  try {
    const publicKey = await subtle.importKey(
      'jwk',
      {
        kty: params.publicKeyJwk.kty,
        crv: params.publicKeyJwk.crv,
        x: params.publicKeyJwk.x,
        y: params.publicKeyJwk.y,
        ext: true,
      },
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      false,
      ['verify']
    );

    const derSignature = jwtEcdsaSignatureToDer(signature);

    const derVerified = await subtle.verify(
      {
        name: 'ECDSA',
        hash: 'SHA-256',
      },
      publicKey,
      toArrayBuffer(derSignature),
      toArrayBuffer(message)
    );

    if (derVerified) {
      return true;
    }

    return await subtle.verify(
      {
        name: 'ECDSA',
        hash: 'SHA-256',
      },
      publicKey,
      toArrayBuffer(signature),
      toArrayBuffer(message)
    );
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

  const signature = base64UrlToBuffer(params.encodedSignature);
  const publicKey = base64UrlToBuffer(params.publicKeyJwk.x);
  const message = utf8ToBytes(params.signingInput);

  if (signature.length !== 64) {
    throw new Error('invalid_signature');
  }

  if (publicKey.length !== 32) {
    throw new Error('unsupported_public_key');
  }

  try {
    return await ed25519.verify(signature, message, publicKey);
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
    if (!isP256Jwk(params.publicKeyJwk)) {
      throw new Error('unsupported_public_key');
    }

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