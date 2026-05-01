import { describe, expect, it } from 'vitest';
import { decryptKey, encryptKey } from './key-management';

describe('key-management', () => {
  const testKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');

  it('encrypts and decrypts a private key round-trip', () => {
    const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const encrypted = encryptKey(privateKey, testKey);
    expect(encrypted).not.toBe(privateKey);
    const decrypted = decryptKey(encrypted, testKey);
    expect(decrypted).toBe(privateKey);
  });

  it('produces different ciphertext for same input (random IV)', () => {
    const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const encrypted1 = encryptKey(privateKey, testKey);
    const encrypted2 = encryptKey(privateKey, testKey);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('fails to decrypt with wrong key', () => {
    const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const wrongKey = Buffer.from('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 'hex');
    const encrypted = encryptKey(privateKey, testKey);
    expect(() => decryptKey(encrypted, wrongKey)).toThrow();
  });
});
