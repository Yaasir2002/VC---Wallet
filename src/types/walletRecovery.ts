export type RecoverableWalletIdentity = {
  did: string;
  provider: 'did:key';
  alias: string;
  method: 'key';
  network: 'none';
  controllerKeyId: string;
  publicKeyBase58: string;
  privateKeySeedHex: string;
  createdAt: string;
  restoredAt?: string;
  recoveryType: 'bip39_ed25519_did_key';
};

export type WalletBackupState = {
  isBackedUp: boolean;
  backedUpAt?: string;
};

export type CreateRecoverableWalletResult = {
  mnemonic: string;
  identity: RecoverableWalletIdentity;
};

export type RestoreRecoverableWalletResult = {
  identity: RecoverableWalletIdentity;
};