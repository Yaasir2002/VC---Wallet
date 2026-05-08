import * as SecureStore from 'expo-secure-store';

const PRIVATE_KEY_PREFIX = 'VERAMO_PRIVATE_KEY_';
const PRIVATE_KEY_INDEX = 'VERAMO_PRIVATE_KEY_INDEX';

type ManagedPrivateKey = {
  alias: string;
  type: string;
  privateKeyHex: string;
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
  await SecureStore.setItemAsync(PRIVATE_KEY_INDEX, JSON.stringify(ids), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

/**
 * Ambil alias private key hanya dari field identifier yang aman.
 *
 * PENTING:
 * Jangan pernah menggunakan privateKeyHex sebagai fallback alias.
 * privateKeyHex adalah data sangat sensitif dan tidak boleh menjadi nama key,
 * index, identifier, log, atau metadata penyimpanan.
 */
function getAlias(args: Partial<ManagedPrivateKey> & {
  kid?: string;
  key?: {
    kid?: string;
  };
}): string | undefined {
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

export class SecurePrivateKeyStore {
  async getKey({ alias }: { alias: string }): Promise<ManagedPrivateKey> {
    validateAlias(alias);

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
      {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }
    );

    const ids = await getKeyIndex();

    if (!ids.includes(alias)) {
      await saveKeyIndex([...ids, alias]);
    }

    return true;
  }

  async deleteKey({ alias }: { alias: string }): Promise<boolean> {
    validateAlias(alias);

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