import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

import { isBiometricEnabled } from '../Storage/authStorage';
import { markSystemUIOpen, markSystemUIClosed } from '../utils/systemUIGuard';

const PRIVATE_KEY_PREFIX = 'VERAMO_PRIVATE_KEY_';
const PRIVATE_KEY_INDEX = 'VERAMO_PRIVATE_KEY_INDEX';
const MAX_ALIAS_LENGTH = 160;

type ManagedPrivateKey = {
  alias: string;
  type: string;
  privateKeyHex: string;
};

type PrivateKeyInput = Partial<ManagedPrivateKey> & {
  kid?: string;
  key?: {
    kid?: string;
  };
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
    const parsed = JSON.parse(data);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

async function saveKeyIndex(ids: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(ids));

  await SecureStore.setItemAsync(
    PRIVATE_KEY_INDEX,
    JSON.stringify(uniqueIds),
    secureStoreOptions
  );
}

/**
 * Ambil alias private key hanya dari identifier aman.
 *
 * Jangan pernah memakai privateKeyHex sebagai fallback alias.
 * privateKeyHex adalah data sangat sensitif dan tidak boleh masuk ke index,
 * nama key, log, maupun metadata penyimpanan.
 */
function getAlias(args: PrivateKeyInput): string | undefined {
  return args.alias || args.kid || args.key?.kid;
}

function validateAlias(alias: string): void {
  const trimmedAlias = alias.trim();

  if (!trimmedAlias) {
    throw new Error('Alias private key tidak boleh kosong');
  }

  if (trimmedAlias.length > MAX_ALIAS_LENGTH) {
    throw new Error('Alias private key terlalu panjang');
  }

  if (trimmedAlias.includes('\n') || trimmedAlias.includes('\r')) {
    throw new Error('Alias private key tidak valid');
  }
}

function validatePrivateKeyHex(privateKeyHex: string): void {
  const normalized = privateKeyHex.startsWith('0x')
    ? privateKeyHex.slice(2)
    : privateKeyHex;

  if (!/^[0-9a-fA-F]+$/.test(normalized)) {
    throw new Error('Private key harus berupa hexadecimal');
  }

  if (normalized.length < 64) {
    throw new Error('Private key hexadecimal terlalu pendek');
  }
}

async function requireBiometricConfirmation(): Promise<void> {
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

  markSystemUIOpen();

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Verifikasi untuk mengakses private key',
      cancelLabel: 'Batal',
      fallbackLabel: 'Gunakan PIN perangkat',
      disableDeviceFallback: false,
    });

    if (!result.success) {
      throw new Error('Autentikasi biometric gagal atau dibatalkan');
    }
  } finally {
    markSystemUIClosed();
  }
}

export class SecurePrivateKeyStore {
  async getKey({ alias }: { alias: string }): Promise<ManagedPrivateKey> {
    validateAlias(alias);

    await requireBiometricConfirmation();

    const data = await SecureStore.getItemAsync(`${PRIVATE_KEY_PREFIX}${alias}`);

    if (!data) {
      throw new Error('Private key tidak ditemukan');
    }

    try {
      const parsed = JSON.parse(data) as ManagedPrivateKey;

      if (!parsed.alias || !parsed.type || !parsed.privateKeyHex) {
        throw new Error('Data private key tidak lengkap');
      }

      return parsed;
    } catch {
      throw new Error('Data private key rusak');
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

    validatePrivateKeyHex(args.privateKeyHex);

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

  async listKeys(): Promise<{ alias: string }[]> {
    const ids = await getKeyIndex();

    return ids.map((id) => ({
      alias: id,
    }));
  }

  async get(args: { alias: string }): Promise<ManagedPrivateKey> {
    return this.getKey(args);
  }

  async import(args: ManagedPrivateKey): Promise<boolean> {
    return this.importKey(args);
  }

  async delete(args: { alias: string }): Promise<boolean> {
    return this.deleteKey(args);
  }

  async list(): Promise<{ alias: string }[]> {
    return this.listKeys();
  }
}