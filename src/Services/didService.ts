import * as Crypto from 'expo-crypto';
import { ethers } from 'ethers';
import { DIDData } from '../types/did';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function generateEthrDID(): DIDData {
  const randomBytes = Crypto.getRandomBytes(32);
  const privateKey = `0x${bytesToHex(randomBytes)}`;

  const wallet = new ethers.Wallet(privateKey);

  return {
    did: `did:ethr:sepolia:${wallet.address}`,
    method: 'ethr',
    network: 'sepolia',
    address: wallet.address,
    privateKey: wallet.privateKey,
    createdAt: new Date().toISOString(),
  };
}