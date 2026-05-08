import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { isBiometricEnabled } from '../Storage/authStorage';

const PRIVATE_KEY_PREFIX = 'VERAMO_PRIVATE_KEY_';
const PRIVATE_KEY_INDEX = 'VERAMO_PRIVATE_KEY_INDEX';

type ManagedPrivateKey = {
  alias: string;
  type: string;
  privateKeyHex: string;
};

const secureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

async function getKeyIndex(): Promise<string[]> {
  const data = await SecureStore.getItemAsync(PRIVATE_KEY_INDEX);

  if (!data) {
    return [];
  }

  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveKeyIndex(ids: string[]) {
  await SecureStore.setItemAsync(
    PRIVATE_KEY_INDEX,
    JSON.stringify(ids),
    secureStoreOptions
  );
}

/**
 * Ambil alias private key hanya dari field identifier yang aman.
 *
 * PENTING:
 * Jangan pernah menggunakan privateKeyHex sebagai fallback alias.
 * privateKeyHex adalah data sangat sensitif dan tidak boleh menjadi nama key,
 * index, identifier, log, atau metadata penyimpanan.
 */
function getAlias(
  args: Partial<ManagedPrivateKey> & {
    kid?: string;
    key?: {
      kid?: string;
    };
  }
): string | undefined {
  return args.alias || args.kid || args.key?.kid;
}

function validateAlias(alias: string) {
  if (!alias.trim()) {
    throw new Error('Alias private key tidak boleh kosong');
  }

  if (alias.includes('\n') || alias.includes('\r')) {
    throw new Error('Alias private key tidak valid');
  }
}

async function requireBiometricConfirmation() {
  const biometricEnabled = await isBiometricEnabled();

  if (!biometricEnabled) {
    return;
  }

  const hasHardware = await LocalAuthentication.hasHardwareAsync();

  if (!hasHardware) {
    throw new Error('Perangkat tidak mendukung autentikasi biometric');
  }

  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (!isEnrolled) {
    throw new Error('Biometric belum terdaftar di perangkat');
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Verifikasi untuk mengakses private key',
    cancelLabel: 'Batal',
    fallbackLabel: 'Gunakan PIN perangkat',
    disableDeviceFallback: false,
  });

  if (!result.success) {
    throw new Error('Autentikasi biometric gagal atau dibatalkan');
  }
}

export class SecurePrivateKeyStore {
  async getKey({ alias }: { alias: string }): Promise<ManagedPrivateKey> {
    validateAlias(alias);

    await requireBiometricConfirmation();

    const data = await SecureStore.getItemAsync(`${PRIVATE_KEY_PREFIX}${alias}`);

    if (!data) {
      throw new Error(`Private key tidak ditemukan untuk alias: ${alias}`);
    }

    try {
      return JSON.parse(data);
    } catch {
      throw new Error(`Data private key rusak untuk alias: ${alias}`);
    }
  }

  async importKey(args: ManagedPrivateKey): Promise<boolean> {
    const alias = getAlias(args);

    if (!alias) {
      throw new Error(
        'Alias private key tidak ditemukan. Alias wajib berasal dari alias, kid, atau key.kid.'
      );
    }

    validateAlias(alias);

    if (!args.type) {
      throw new Error('Tipe private key tidak ditemukan');
    }

    if (!args.privateKeyHex) {
      throw new Error('Private key tidak ditemukan');
    }

    const keyData: ManagedPrivateKey = {
      alias,
      type: args.type,
      privateKeyHex: args.privateKeyHex,
    };

    await SecureStore.setItemAsync(
      `${PRIVATE_KEY_PREFIX}${alias}`,
      JSON.stringify(keyData),
      secureStoreOptions
    );

    const ids = await getKeyIndex();

    if (!ids.includes(alias)) {
      await saveKeyIndex([...ids, alias]);
    }

    return true;
  }

  async deleteKey({ alias }: { alias: string }): Promise<boolean> {
    validateAlias(alias);

    await requireBiometricConfirmation();

    await SecureStore.deleteItemAsync(`${PRIVATE_KEY_PREFIX}${alias}`);

    const ids = await getKeyIndex();
    await saveKeyIndex(ids.filter((id) => id !== alias));

    return true;
  }

  async listKeys(): Promise<Array<{ alias: string }>> {
    const ids = await getKeyIndex();

    return ids.map((id) => ({
      alias: id,
    }));
  }

  // Compatibility alias, supaya aman kalau ada bagian lain memanggil nama lama
  async get(args: { alias: string }) {
    return this.getKey(args);
  }

  async import(args: ManagedPrivateKey) {
    return this.importKey(args);
  }

  async delete(args: { alias: string }) {
    return this.deleteKey(args);
  }

  async list() {
    return this.listKeys();
  }
}