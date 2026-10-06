/**
 * Model Discovery Service
 * Auto-discovers models from provider APIs and caches in database
 */

import mongoose from 'mongoose';
import { AIProvider } from '../../models/AIProvider.ts';
import { AIModel } from '../../models/AIModel.ts';
import {
  getProviderDefinition,
  detectCapabilities,
  formatModelName,
  isFreeTierModel,
  isVisionModel,
  ProviderId
} from '../../config/aiProviders.ts';
import { decrypt } from '../../utils/encryption.ts';

interface DiscoveredModel {
  modelId: string;
  displayName: string;
  capabilities: ReturnType<typeof detectCapabilities>;
  pricing?: { input: number; output: number };
  isFreeTier: boolean;
}

interface DiscoveryResult {
  providerId: string;
  providerName: string;
  models: DiscoveredModel[];
  error?: string;
  durationMs: number;
}

/**
 * Discover models for a single provider
 */
export async function discoverModelsForProvider(provider: any): Promise<DiscoveryResult> {
  const startTime = Date.now();
  const providerDef = getProviderDefinition(provider.providerId as ProviderId);

  if (!providerDef) {
    return {
      providerId: provider._id.toString(),
      providerName: provider.name,
      models: [],
      error: `Unknown provider: ${provider.providerId}`,
      durationMs: Date.now() - startTime,
    };
  }

  // For custom/selfhosted, use custom baseUrl
  const baseUrl = provider.baseUrl || providerDef.baseUrl;
  if (!baseUrl) {
    return {
      providerId: provider._id.toString(),
      providerName: provider.name,
      models: [],
      error: 'Base URL not configured',
      durationMs: Date.now() - startTime,
    };
  }

  // Find first active API key
  const activeKey = provider.apiKeys?.find((k: any) => k.isActive && (!k.cooldownUntil || k.cooldownUntil < new Date()));
  if (!activeKey && providerDef.authType !== 'none') {
    return {
      providerId: provider._id.toString(),
      providerName: provider.name,
      models: [],
      error: 'No active API key available',
      durationMs: Date.now() - startTime,
    };
  }

  const decryptedKey = activeKey ? decrypt(activeKey.key) : '';
  const endpoint = `${baseUrl.replace(/\/$/, '')}${providerDef.modelsEndpoint}`;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // Add auth header based on provider type
    if (providerDef.authType === 'bearer') {
      headers['Authorization'] = `Bearer ${decryptedKey}`;
    } else if (providerDef.authType === 'google') {
      headers['x-goog-api-key'] = decryptedKey;
    } else if (providerDef.authType === 'api_key') {
      headers['X-API-Key'] = decryptedKey;
    }

    // Add custom headers
    for (const h of provider.customHeaders || []) {
      const value = h.isSecret && h.value ? decrypt(h.value) : h.value;
      headers[h.key] = value;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // Parse models - handle different response formats
    let rawModels: any[] = [];
    if (data.data && Array.isArray(data.data)) {
      rawModels = data.data; // OpenAI format: { data: [...] }
    } else if (data.models && Array.isArray(data.models)) {
      rawModels = data.models; // Alternative format: { models: [...] }
    } else if (Array.isArray(data)) {
      rawModels = data; // Direct array
    }

    const models: DiscoveredModel[] = rawModels
      .filter((m: any) => m.id || m.name) // Must have an ID
      .map((m: any) => {
        const modelId = m.id || m.name;
        const displayName = formatModelName(modelId);
        const capabilities = detectCapabilities(modelId, provider.providerId as ProviderId);

        return {
          modelId,
          displayName,
          capabilities,
          pricing: extractPricing(m),
          isFreeTier: isFreeTierModel(provider.providerId as ProviderId, modelId) ||
                      (capabilities.vision && isVisionModel(provider.providerId as ProviderId, modelId)),
        };
      });

    // Upsert to database
    await upsertModels(provider._id.toString(), provider.name, models);

    return {
      providerId: provider._id.toString(),
      providerName: provider.name,
      models,
      durationMs: Date.now() - startTime,
    };
  } catch (err: any) {
    console.error(`[ModelDiscovery] Failed for ${provider.name}:`, err.message);
    return {
      providerId: provider._id.toString(),
      providerName: provider.name,
      models: [],
      error: err.message,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Extract pricing info from model data (if available)
 */
function extractPricing(modelData: any): { input: number; output: number } | undefined {
  // OpenRouter format
  if (modelData.pricing) {
    return {
      input: parseFloat(modelData.pricing.prompt || modelData.pricing.input || '0') * 1000000,
      output: parseFloat(modelData.pricing.completion || modelData.pricing.output || '0') * 1000000,
    };
  }
  // Some providers use different fields
  if (modelData.input_price || modelData.output_price) {
    return {
      input: parseFloat(modelData.input_price) * 1000000,
      output: parseFloat(modelData.output_price) * 1000000,
    };
  }
  return undefined;
}

/**
 * Bulk upsert discovered models to database
 */
async function upsertModels(providerId: string, providerName: string, models: DiscoveredModel[]): Promise<void> {
  // Discovery-only providers (e.g. the "inline" temp provider) are not persisted, so skip the DB write
  if (!mongoose.Types.ObjectId.isValid(providerId)) {
    console.log(`[ModelDiscovery] Skipping DB upsert for non-persisted provider "${providerId}"`);
    return;
  }

  const objectId = new mongoose.Types.ObjectId(providerId);

  const operations = models.map(model => ({
    updateOne: {
      filter: { providerId: objectId, modelId: model.modelId },
      update: {
        $set: {
          displayName: model.displayName,
          capabilities: model.capabilities,
          pricing: model.pricing,
          isFreeTier: model.isFreeTier,
          isActive: true,
          lastChecked: new Date(),
        },
        $inc: { checkCount: 1 },
        $unset: { lastCheckError: '' },
        $setOnInsert: {
          providerId: objectId,
          providerName,
          modelId: model.modelId,
          discoveredAt: new Date(),
        },
      },
      upsert: true,
    },
  }));

  if (operations.length > 0) {
    await AIModel.bulkWrite(operations as any, { ordered: false });
    console.log(`[ModelDiscovery] Upserted ${operations.length} models for ${providerName}`);
  }
}

/**
 * Discover models for all enabled providers
 */
export async function discoverModelsForAllProviders(): Promise<DiscoveryResult[]> {
  console.log('[ModelDiscovery] Starting discovery for all enabled providers...');

  const providers = await AIProvider.find({ isEnabled: true }).lean();

  if (providers.length === 0) {
    console.log('[ModelDiscovery] No enabled providers found');
    return [];
  }

  const results = await Promise.allSettled(
    providers.map(p => discoverModelsForProvider(p))
  );

  const discoveryResults: DiscoveryResult[] = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      providerId: providers[i]._id.toString(),
      providerName: providers[i].name,
      models: [],
      error: r.reason?.message || 'Unknown error',
      durationMs: 0,
    };
  });

  // Summary
  const totalModels = discoveryResults.reduce((sum, r) => sum + r.models.length, 0);
  const errors = discoveryResults.filter(r => r.error).length;

  console.log(`[ModelDiscovery] Completed: ${totalModels} models discovered, ${errors} provider(s) failed`);

  for (const r of discoveryResults) {
    if (r.error) {
      console.warn(`[ModelDiscovery] ❌ ${r.providerName}: ${r.error}`);
    } else {
      console.log(`[ModelDiscovery] ✅ ${r.providerName}: ${r.models.length} models (${r.durationMs}ms)`);
    }
  }

  return discoveryResults;
}

/**
 * Get discovered models for a provider (from cache)
 */
export async function getCachedModels(providerId: string, taskType?: string): Promise<any[]> {
  const query: any = { providerId, isActive: true };

  if (taskType) {
    switch (taskType) {
      case 'vision':
      case 'verify':
      case 'food':
        query['capabilities.vision'] = true;
        break;
    }
  }

  return AIModel.find(query).sort({ isFreeTier: -1, 'capabilities.maxContext': -1 }).lean();
}

/**
 * Refresh models for a specific provider (admin trigger)
 */
export async function refreshProviderModels(providerId: string): Promise<DiscoveryResult> {
  const provider = await AIProvider.findById(providerId);
  if (!provider) {
    throw new Error('Provider not found');
  }
  return discoverModelsForProvider(provider);
}

/**
 * Check if a specific model exists and is active
 */
export async function checkModelAvailability(providerId: string, modelId: string): Promise<boolean> {
  const model = await AIModel.findOne({ providerId, modelId, isActive: true });
  return !!model;
}

/**
 * Get model info with capabilities
 */
export async function getModelInfo(providerId: string, modelId: string): Promise<any> {
  return AIModel.findOne({ providerId, modelId }).lean();
}