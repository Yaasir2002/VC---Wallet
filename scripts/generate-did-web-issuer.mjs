import { exportJWK, generateKeyPair } from 'jose';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const issuerDomain = process.argv[2];

if (!issuerDomain) {
  console.error('Usage: node scripts/generate-did-web-issuer.mjs <issuer-domain>');
  console.error('Example: node scripts/generate-did-web-issuer.mjs vc-issuer.yaasir.dev');
  process.exit(1);
}

const did = `did:web:${issuerDomain}`;
const keyId = `${did}#key-1`;

const { publicKey, privateKey } = await generateKeyPair('ES256', {
  extractable: true,
});

const publicJwk = await exportJWK(publicKey);
const privateJwk = await exportJWK(privateKey);

publicJwk.alg = 'ES256';
publicJwk.use = 'sig';
publicJwk.kid = keyId;

privateJwk.alg = 'ES256';
privateJwk.use = 'sig';
privateJwk.kid = keyId;

const didDocument = {
  '@context': [
    'https://www.w3.org/ns/did/v1',
    'https://w3id.org/security/jwk/v1',
  ],
  id: did,
  verificationMethod: [
    {
      id: keyId,
      type: 'JsonWebKey2020',
      controller: did,
      publicKeyJwk: publicJwk,
    },
  ],
  assertionMethod: [keyId],
  authentication: [keyId],
};

const outputDir = path.resolve('issuer-output');
await mkdir(outputDir, { recursive: true });

await writeFile(
  path.join(outputDir, 'did.json'),
  JSON.stringify(didDocument, null, 2)
);

await writeFile(
  path.join(outputDir, 'issuer-private-jwk.json'),
  JSON.stringify(privateJwk, null, 2)
);

await writeFile(
  path.join(outputDir, 'issuer-public-jwk.json'),
  JSON.stringify(publicJwk, null, 2)
);

console.log('Issuer DID generated successfully.');
console.log(`DID: ${did}`);
console.log(`Key ID: ${keyId}`);
console.log('');
console.log('Upload this file to your HTTPS domain:');
console.log(`issuer-output/did.json -> https://${issuerDomain}/.well-known/did.json`);
console.log('');
console.log('KEEP THIS FILE SECRET. Do not commit it:');
console.log('issuer-output/issuer-private-jwk.json');