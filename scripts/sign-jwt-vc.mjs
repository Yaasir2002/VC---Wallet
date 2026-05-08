import { importJWK, SignJWT } from 'jose';
import { readFile, writeFile } from 'node:fs/promises';

const privateJwkPath = process.argv[2];
const outputPath = process.argv[3] || 'issuer-output/sample-vc.jwt';

if (!privateJwkPath) {
  console.error('Usage: node scripts/sign-jwt-vc.mjs <private-jwk-path> [output-path]');
  console.error('Example: node scripts/sign-jwt-vc.mjs issuer-output/issuer-private-jwk.json issuer-output/sample-vc.jwt');
  process.exit(1);
}

const privateJwk = JSON.parse(await readFile(privateJwkPath, 'utf8'));

if (!privateJwk.kid) {
  throw new Error('Private JWK must contain kid');
}

const issuerDid = privateJwk.kid.split('#')[0];
const subjectDid = 'did:example:holder-123';

const privateKey = await importJWK(privateJwk, 'ES256');

const now = Math.floor(Date.now() / 1000);
const exp = now + 60 * 60 * 24 * 365;

const vcPayload = {
  '@context': ['https://www.w3.org/2018/credentials/v1'],
  type: ['VerifiableCredential', 'StudentCredential', 'KtmCredential'],
  issuer: issuerDid,
  issuanceDate: new Date(now * 1000).toISOString(),
  expirationDate: new Date(exp * 1000).toISOString(),
  credentialSubject: {
    id: subjectDid,
    nama: 'Yaasir Aidil Fitrah',
    nim: '123456789',
    programStudi: 'Teknik Informatika',
  },
};

const jwt = await new SignJWT({
  vc: vcPayload,
})
  .setProtectedHeader({
    alg: 'ES256',
    kid: privateJwk.kid,
    typ: 'JWT',
  })
  .setIssuer(issuerDid)
  .setSubject(subjectDid)
  .setJti(`urn:uuid:${crypto.randomUUID()}`)
  .setIssuedAt(now)
  .setNotBefore(now)
  .setExpirationTime(exp)
  .sign(privateKey);

await writeFile(outputPath, jwt);

console.log('JWT VC signed successfully.');
console.log(`Issuer: ${issuerDid}`);
console.log(`Key ID: ${privateJwk.kid}`);
console.log(`Output: ${outputPath}`);
console.log('');
console.log(jwt);