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
  return data ? JSON.parse(data) : [];
}

async function saveKeyIndex(ids: string[]) {
  await SecureStore.setItemAsync(PRIVATE_KEY_INDEX, JSON.stringify(ids), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

function getAlias(args: any): string {
  return args?.alias || args?.kid || args?.key?.kid || args?.privateKeyHex;
}

export class SecurePrivateKeyStore {
  async getKey({ alias }: { alias: string }): Promise<ManagedPrivateKey> {
    const data = await SecureStore.getItemAsync(`${PRIVATE_KEY_PREFIX}${alias}`);

    if (!data) {
      throw new Error(`Private key tidak ditemukan untuk alias: ${alias}`);
    }

    return JSON.parse(data);
  }

  async importKey(args: ManagedPrivateKey): Promise<boolean> {
    const alias = getAlias(args);

    if (!alias) {
      throw new Error('Alias private key tidak ditemukan');
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