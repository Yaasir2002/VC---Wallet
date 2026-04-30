import * as SecureStore from 'expo-secure-store';

const PRIVATE_KEY_PREFIX = 'VERAMO_PRIVATE_KEY_';
const PRIVATE_KEY_INDEX = 'VERAMO_PRIVATE_KEY_INDEX';

async function getKeyIndex(): Promise<string[]> {
  const data = await SecureStore.getItemAsync(PRIVATE_KEY_INDEX);
  return data ? JSON.parse(data) : [];
}

async function saveKeyIndex(ids: string[]) {
  await SecureStore.setItemAsync(PRIVATE_KEY_INDEX, JSON.stringify(ids), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export class SecurePrivateKeyStore {
  async get({ alias }: { alias: string }) {
    const data = await SecureStore.getItemAsync(`${PRIVATE_KEY_PREFIX}${alias}`);

    if (!data) {
      throw new Error(`Private key tidak ditemukan untuk alias: ${alias}`);
    }

    return JSON.parse(data);
  }

  async import(args: any) {
    const alias = args.alias || args.kid || args.key?.kid;

    if (!alias) {
      throw new Error('Alias private key tidak ditemukan');
    }

    await SecureStore.setItemAsync(
      `${PRIVATE_KEY_PREFIX}${alias}`,
      JSON.stringify(args),
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

  async delete({ alias }: { alias: string }) {
    await SecureStore.deleteItemAsync(`${PRIVATE_KEY_PREFIX}${alias}`);

    const ids = await getKeyIndex();
    await saveKeyIndex(ids.filter((id) => id !== alias));

    return true;
  }

  async list() {
    const ids = await getKeyIndex();

    return ids.map((id) => ({
      alias: id,
    }));
  }
}