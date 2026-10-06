/**
 * AIProvider Model
 * Stores provider configuration with multiple API keys, strategy settings
 */

import mongoose from 'mongoose';
import { encrypt, decrypt } from '../utils/encryption.ts';

const APIKeySchema = new mongoose.Schema({
  key: { type: String, required: true }, // encrypted
  label: { type: String, required: true, default: 'Key' },
  isActive: { type: Boolean, default: true },
  priority: { type: Number, default: 1, min: 1 }, // Lower = higher priority
  lastUsed: { type: Date, default: null },
  failCount: { type: Number, default: 0 },
  cooldownUntil: { type: Date, default: null },
}, { _id: true });

const CustomHeaderSchema = new mongoose.Schema({
  key: { type: String, required: true },
  value: { type: String, required: true },
  isSecret: { type: Boolean, default: false }, // If true, value will be encrypted
}, { _id: false });

const AIProviderSchema = new mongoose.Schema({
  providerId: {
    type: String,
    required: true,
    enum: ['google', 'openrouter', 'groq', 'cohere', 'custom', 'selfhosted'],
    index: true
  },
  name: { type: String, required: true },
  isEnabled: { type: Boolean, default: true, index: true },

  // Multiple API keys with priority
  apiKeys: { type: [APIKeySchema], default: [] },

  // Custom/Self-hosted configuration
  baseUrl: { type: String, default: '' },
  customHeaders: { type: [CustomHeaderSchema], default: [] },

  // Model selection (admin chooses from discovered models)
  selectedModelIds: { type: [String], default: [] },

  // Strategy for selecting among keys/models within this provider
  strategy: {
    type: String,
    enum: ['round-robin', 'fallback', 'priority'],
    default: 'fallback'
  },

  // Default request settings
  defaultTimeoutMs: { type: Number, default: 45000, min: 1000 },
  defaultRetries: { type: Number, default: 2, min: 0, max: 10 },

  // Metadata
  createdBy: { type: String, default: 'system' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Indexes
AIProviderSchema.index({ providerId: 1, isEnabled: 1 });
AIProviderSchema.index({ createdAt: -1 });

// Virtual for active keys count
AIProviderSchema.virtual('activeKeysCount').get(function() {
  return this.apiKeys?.filter((k: any) => k.isActive && (!k.cooldownUntil || k.cooldownUntil < new Date())).length || 0;
});

// Method to get decrypted keys (for internal use only)
AIProviderSchema.methods.getDecryptedKeys = function() {
  return this.apiKeys
    .filter((k: any) => k.isActive)
    .map((k: any) => ({
      ...k.toObject(),
      key: decrypt(k.key),
    }));
};

// Method to get next key based on strategy
AIProviderSchema.methods.getNextKey = function(currentKeyIndex?: number) {
  const activeKeys = this.apiKeys
    .filter((k: any) => k.isActive && (!k.cooldownUntil || k.cooldownUntil < new Date()))
    .sort((a: any, b: any) => a.priority - b.priority);

  if (activeKeys.length === 0) return null;

  if (this.strategy === 'round-robin') {
    const nextIndex = (currentKeyIndex || 0) % activeKeys.length;
    return { key: decrypt(activeKeys[nextIndex].key), keyDoc: activeKeys[nextIndex], index: nextIndex };
  }

  // fallback or priority: use first (highest priority)
  return { key: decrypt(activeKeys[0].key), keyDoc: activeKeys[0], index: 0 };
};

// Method to mark key cooldown
AIProviderSchema.methods.markKeyCooldown = async function(keyId: string, cooldownMs: number = 60000) {
  const keyDoc = this.apiKeys.id(keyId);
  if (keyDoc) {
    keyDoc.cooldownUntil = new Date(Date.now() + cooldownMs);
    keyDoc.failCount += 1;
    await this.save();
  }
};

// Method to reset key cooldown
AIProviderSchema.methods.resetKeyCooldown = async function(keyId: string) {
  const keyDoc = this.apiKeys.id(keyId);
  if (keyDoc) {
    keyDoc.cooldownUntil = null;
    keyDoc.failCount = 0;
    await this.save();
  }
};

// Method to add API key
AIProviderSchema.methods.addApiKey = async function(label: string, key: string, priority?: number) {
  const encryptedKey = encrypt(key);
  const newKey = {
    key: encryptedKey,
    label,
    isActive: true,
    priority: priority || (this.apiKeys.length + 1),
  };
  this.apiKeys.push(newKey);
  await this.save();
  return this.apiKeys[this.apiKeys.length - 1];
};

// Method to update API key
AIProviderSchema.methods.updateApiKey = async function(keyId: string, updates: { label?: string; isActive?: boolean; priority?: number }) {
  const keyDoc = this.apiKeys.id(keyId);
  if (keyDoc) {
    Object.assign(keyDoc, updates);
    await this.save();
  }
  return keyDoc;
};

// Method to delete API key
AIProviderSchema.methods.deleteApiKey = async function(keyId: string) {
  this.apiKeys.pull(keyId);
  await this.save();
};

export const AIProvider = mongoose.model('AIProvider', AIProviderSchema);

export interface APIKeyDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  key: string;
  label: string;
  isActive: boolean;
  priority: number;
  lastUsed?: Date;
  failCount: number;
  cooldownUntil?: Date;
}

export interface AIProviderDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  providerId: 'google' | 'openrouter' | 'groq' | 'cohere' | 'custom' | 'selfhosted';
  name: string;
  isEnabled: boolean;
  apiKeys: APIKeyDoc[];
  baseUrl: string;
  customHeaders: Array<{ key: string; value: string; isSecret: boolean }>;
  selectedModelIds: string[];
  strategy: 'round-robin' | 'fallback' | 'priority';
  defaultTimeoutMs: number;
  defaultRetries: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;

  getDecryptedKeys(): Array<APIKeyDoc & { key: string }>;
  getNextKey(currentKeyIndex?: number): { key: string; keyDoc: APIKeyDoc; index: number } | null;
  markKeyCooldown(keyId: string, cooldownMs?: number): Promise<void>;
  resetKeyCooldown(keyId: string): Promise<void>;
  addApiKey(label: string, key: string, priority?: number): Promise<APIKeyDoc>;
  updateApiKey(keyId: string, updates: { label?: string; isActive?: boolean; priority?: number }): Promise<APIKeyDoc | null>;
  deleteApiKey(keyId: string): Promise<void>;
}