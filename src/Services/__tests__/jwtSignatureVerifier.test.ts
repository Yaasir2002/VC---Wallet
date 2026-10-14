import { p256 } from '@noble/curves/p256';
import { sha256 } from '@noble/hashes/sha256';
import { verifyJwtSignature } from '../jwtSignatureVerifier';

test('ES256 accepts both JOSE signature forms and rejects modified payloads', async () => {
  const privateKey = new Uint8Array(32).fill(1);
  const publicKey = p256.getPublicKey(privateKey, false);
  const signingInput = 'header.payload';
  const signature = p256.sign(sha256(new TextEncoder().encode(signingInput)), privateKey);
  const publicKeyJwk = {
    kty: 'EC', crv: 'P-256',
    x: Buffer.from(publicKey.slice(1, 33)).toString('base64url'),
    y: Buffer.from(publicKey.slice(33)).toString('base64url'),
  };
  for (const candidate of [signature, new p256.Signature(signature.r, p256.CURVE.n - signature.s)]) {
    const params = {
      header: { alg: 'ES256', kid: 'test-key' }, signingInput, publicKeyJwk,
      encodedSignature: Buffer.from(candidate.toCompactRawBytes()).toString('base64url'),
    };
    expect(await verifyJwtSignature(params)).toBe(true);
    expect(await verifyJwtSignature({ ...params, signingInput: 'header.changed' })).toBe(false);
    await expect(verifyJwtSignature({ ...params, header: { alg: 'none', kid: 'test-key' } })).rejects.toThrow('unsupported_algorithm');
  }
});
