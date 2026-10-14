import { expect, test } from '@playwright/test';
import { exportJWK, generateKeyPair, jwtVerify, SignJWT } from 'jose';
import bs58 from 'bs58';

test('create wallet, preserve encrypted identity on reload, authenticate and edit profile', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByText('Buat Wallet Baru', { exact: true }).click();
  await expect(page.getByText('12 Kata Recovery', { exact: true })).toBeVisible();
  await page.getByText('Saya sudah menyimpan recovery phrase ini di tempat yang aman.').click();
  await page.getByText('Lanjut Buat PIN', { exact: true }).click();
  const pins = page.locator('input[type="password"]');
  await pins.nth(0).fill('123456');
  await pins.nth(1).fill('123456');
  await page.getByText('Simpan & Masuk Wallet', { exact: true }).click();
  await expect(page.getByText('Active DID', { exact: true })).toBeVisible();
  const did = await page.getByText(/^did:key:z/).first().innerText();
  await page.reload();
  await expect(page.getByText('Unlock Wallet', { exact: true })).toBeVisible();
  await page.locator('input[type="password"]').fill('123456');
  await page.getByText('Unlock', { exact: true }).click();
  await expect(page.getByText(did, { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Settings/ }).click();
  await page.getByText('View Recovery Phrase', { exact: true }).click();
  await page.getByRole('textbox', { name: 'PIN Wallet' }).fill('123456');
  await page.getByRole('button', { name: 'Konfirmasi', exact: true }).click();
  await expect(page.getByText('12 Kata Recovery', { exact: true })).toBeVisible();
  const stored = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('nf-identity-wallet');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<{ encrypted: boolean; extractable: boolean }>((resolve) => {
      const transaction = database.transaction('wallet');
      const store = transaction.objectStore('wallet');
      const key = store.get('encryption-key');
      const mnemonic = store.get('value:VC_WALLET_RECOVERY_MNEMONIC_V1');
      transaction.oncomplete = () => {
        resolve({ encrypted: mnemonic.result.ciphertext instanceof ArrayBuffer, extractable: key.result.extractable });
        database.close();
      };
    });
  });
  expect(stored).toEqual({ encrypted: true, extractable: false });

  await page.goBack();
  await page.getByText('Edit', { exact: true }).click();
  await page.getByPlaceholder('Masukkan nama lengkap').fill('Pengguna Uji Web');
  await page.getByPlaceholder('Masukkan email').fill('uji@example.com');
  await page.getByPlaceholder('Masukkan nomor HP').fill('081234567890');
  await page.getByPlaceholder('Masukkan alamat', { exact: true }).fill('Alamat pengujian');
  await page.getByText('Simpan Perubahan', { exact: true }).click();
  await expect(page.getByText('Pengguna Uji Web', { exact: true })).toBeVisible();

  const issuer = 'did:web:identitylab.id';
  const kid = `${issuer}#key-1`;
  const keys = await generateKeyPair('ES256', { extractable: true });
  await page.route('https://identitylab.id/.well-known/did.json', async (route) => {
    await route.fulfill({ json: {
      id: issuer,
      verificationMethod: [{ id: kid, controller: issuer, publicKeyJwk: await exportJWK(keys.publicKey) }],
      assertionMethod: [kid],
    } });
  });
  const credential = {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    type: ['VerifiableCredential', 'StudentCredential'],
    id: 'urn:uuid:web-test', documentId: 'urn:uuid:web-test',
    documentType: 'KTM', documentName: 'Credential Uji Web', issuer,
    issuanceDate: new Date(Date.now() - 1000).toISOString(),
    credentialSubject: { id: did, name: 'Pengguna Uji Web', nim: 'TEST123' },
  };
  const vcJwt = await new SignJWT(credential).setProtectedHeader({ alg: 'ES256', kid }).setIssuer(issuer).sign(keys.privateKey);
  await page.getByRole('tab', { name: /Wallet/ }).click();
  await page.getByText('Tambah Credential', { exact: true }).click();
  await page.getByText('Import JSON Credential', { exact: true }).click();
  await page.getByPlaceholder('Paste JSON credential di sini...').fill(JSON.stringify({ ...credential, jwt: vcJwt }));
  const imported = page.waitForEvent('dialog');
  await page.getByText('Import Credential', { exact: true }).last().click();
  const importDialog = await imported;
  expect(importDialog.message()).toContain('Status: verified');
  await importDialog.accept();
  await expect(page).toHaveURL(/\/credential\/create$/);
  await page.getByRole('button', { name: 'Kembali', exact: true }).click();
  await expect(page.getByText('Credential Uji Web', { exact: true })).toBeVisible();
  await page.getByText('Credential Uji Web', { exact: true }).click();
  await page.getByRole('textbox', { name: 'PIN Wallet' }).fill('123456');
  await page.getByRole('button', { name: 'Konfirmasi', exact: true }).click();
  await page.getByText('Buat Signed VP JWT', { exact: true }).click();
  await expect(page.getByText('Signed VP JWT', { exact: true })).toBeVisible();
  await page.getByText('Lihat Full JWT', { exact: true }).click();
  const vpJwt = await page.getByText(/^eyJ[^\s]+\.[^\s]+\.[^\s]+$/).innerText();
  const rawKey = bs58.decode(did.replace('did:key:z', '')).slice(2);
  const publicKey = await (await import('jose')).importJWK({ kty: 'OKP', crv: 'Ed25519', x: Buffer.from(rawKey).toString('base64url') }, 'EdDSA');
  const verifiedVp = await jwtVerify(vpJwt, publicKey, { issuer: did });
  const vp = verifiedVp.payload.vp as { holder: string; verifiableCredential: { id: string }[] };
  expect(vp.holder).toBe(did);
  expect(vp.verifiableCredential[0].id).toBe(`data:application/vc+jwt,${vcJwt}`);
  expect(errors).toEqual([]);
});
