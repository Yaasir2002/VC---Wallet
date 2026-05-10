export type RecoverableWalletIdentity = {
  did: string;
  provider: string;
  alias?: string;
  method: 'key';
  network: 'none';
  controllerKeyId: string;
  publicKeyBase58: string;
  privateKeySeedHex: string;
  createdAt: string;
  restoredAt?: string;
  recoveryType: 'mnemonic_bip39_ed25519';
};

export type WalletRecoveryBackupState = {
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