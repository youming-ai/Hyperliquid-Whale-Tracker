import { describe, expect, it } from 'vitest';
import { generateAgentWallet } from './agent-wallets';

describe('agent-wallets', () => {
  const testEncryptionKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');

  it('generates a wallet with address and encrypted key', () => {
    const wallet = generateAgentWallet(testEncryptionKey);
    expect(wallet.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(wallet.encryptedPrivateKey).toBeTruthy();
    expect(wallet.encryptedPrivateKey).not.toMatch(/^0x/);
    expect(wallet.encryptedPrivateKey.length).toBeGreaterThan(0);
  });

  it('generates unique wallets each time', () => {
    const wallet1 = generateAgentWallet(testEncryptionKey);
    const wallet2 = generateAgentWallet(testEncryptionKey);
    expect(wallet1.address).not.toBe(wallet2.address);
    expect(wallet1.encryptedPrivateKey).not.toBe(wallet2.encryptedPrivateKey);
  });
});
