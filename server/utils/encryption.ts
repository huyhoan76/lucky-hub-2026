/**
 * AES-256-GCM Encryption Utility
 * Used for encrypting/decrypting API keys, tokens, and sensitive data
 */

import crypto from 'crypto';

// Get encryption key from environment (32 bytes = 256 bits)
function getEncryptionKey(): Buffer {
  const keyB64 = process.env.AI_ENCRYPTION_KEY;
  if (!keyB64) {
    throw new Error('AI_ENCRYPTION_KEY environment variable is required. Generate with: openssl rand -base64 32');
  }
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) {
    throw new Error('AI_ENCRYPTION_KEY must be 32 bytes (base64 encoded)');
  }
  return key;
}

/**
 * Encrypt plaintext using AES-256-GCM
 * Returns base64 encoded string: iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/**
 * Decrypt ciphertext encrypted with encrypt()
 */
export function decrypt(encrypted: string): string {
  if (!encrypted) return '';

  try {
    const key = getEncryptionKey();
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format');
    }

    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const ciphertext = Buffer.from(parts[2], 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);

    return plaintext.toString('utf8');
  } catch (err: any) {
    console.error('[Encryption] Decrypt failed:', err.message);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Encrypt multiple strings at once (for bulk operations)
 */
export function encryptMultiple(plaintexts: string[]): string[] {
  return plaintexts.map(encrypt);
}

/**
 * Decrypt multiple strings at once
 */
export function decryptMultiple(encrypted: string[]): string[] {
  return encrypted.map(decrypt);
}

/**
 * Mask API key for display (show first 6 and last 4 chars)
 */
export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 10) return '••••••';
  return `${key.substring(0, 6)}••••${key.substring(key.length - 4)}`;
}

/**
 * Generate a new encryption key (for setup)
 * Run: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('base64');
}