import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { decryptKey, encryptKey } from './key-management';

export interface GeneratedWallet {
  address: string;
  encryptedPrivateKey: string;
}

export function generateAgentWallet(encryptionKey: Buffer): GeneratedWallet {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const encryptedPrivateKey = encryptKey(privateKey, encryptionKey);
  return {
    address: account.address,
    encryptedPrivateKey,
  };
}

export function getWalletPrivateKey(
  encryptedPrivateKey: string,
  encryptionKey: Buffer,
): `0x${string}` {
  return decryptKey(encryptedPrivateKey, encryptionKey) as `0x${string}`;
}
