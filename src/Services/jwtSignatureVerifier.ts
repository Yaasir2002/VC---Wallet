// File: src/Services/jwtSignatureVerifier.ts

import * as ed25519 from '@noble/ed25519';
import { importJWK, jwtVerify } from 'jose';

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

async function ensureWebCryptoAvailable(): Promise<void> {
  const currentCrypto = (globalThis as any).crypto;

  if (currentCrypto?.subtle) return;

  try {
    const ExpoCrypto = await import('expo-crypto');

    if ((ExpoCrypto as any)?.Crypto) {
      (globalThis as any).crypto = new (ExpoCrypto as any).Crypto();
    }

    if (!(globalThis as any).crypto?.subtle) {
      throw new Error('crypto_subtle_not_available');
    }
  } catch {
    throw new Error('crypto_subtle_not_available');
  }
}

async function verifyEs256JwtSignature(params: {
  header: JwtHeader;
  encodedSignature: string;
  signingInput: string;
  publicKeyJwk: SupportedPublicKeyJwk;
}): Promise<boolean> {
  if (!isP256Jwk(params.publicKeyJwk)) {
    throw new Error('unsupported_public_key');
  }

  await ensureWebCryptoAvailable();

  try {
    const publicKey = await importJWK(
      {
        kty: 'EC',
        crv: 'P-256',
        x: params.publicKeyJwk.x,
        y: params.publicKeyJwk.y,
      },
      'ES256'
    );

    const compactJwt = `${params.signingInput}.${params.encodedSignature}`;

    await jwtVerify(compactJwt, publicKey, {
      algorithms: ['ES256'],
    });

    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'crypto_subtle_not_available'
    ) {
      throw error;
    }

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
    return verifyEs256JwtSignature({
      header: params.header,
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