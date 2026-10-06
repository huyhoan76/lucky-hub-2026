/**
 * AI System Migration Script
 * Migrates from old GeminiKey + AIConfig system to new AIProvider + AITaskConfig system
 * Run once: npm run migrate:ai
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { AIProvider } from '../server/models/AIProvider.ts';
import { AIModel } from '../server/models/AIModel.ts';
import { AITaskConfig } from '../server/models/AITaskConfig.ts';
import { discoverModelsForProvider } from '../server/services/ai/modelDiscovery.ts';
import { encrypt } from '../server/utils/encryption.ts';

/**
 * The legacy models (GeminiKey/AIConfig) were deleted once the migration was verified.
 * Load them lazily so this script still runs on an environment that no longer has them.
 */
async function loadLegacyModels(): Promise<{ GeminiKey: any; AIConfig: any }> {
  const load = async (specifier: string) => {
    try {
      return await import(specifier);
    } catch {
      return null;
    }
  };

  const geminiModule = await load('../server/models/GeminiKey.ts');
  const configModule = await load('../server/models/AIConfig.ts');
  return {
    GeminiKey: geminiModule?.GeminiKey ?? null,
    AIConfig: configModule?.AIConfig ?? null,
  };
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lucky_hub';

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
    });
    console.log('✅ Connected to MongoDB');
  } catch (err: any) {
    console.error('❌ DB Connection Error:', err.message);
    process.exit(1);
  }
}

export async function migrateAISystem() {
  console.log('\n🚀 ============ AI SYSTEM MIGRATION ============\n');
  const startTime = Date.now();

  try {
    const { GeminiKey, AIConfig } = await loadLegacyModels();

    // ==========================================
    // STEP 1: Migrate Gemini Keys to AIProviders
    // ==========================================
    console.log('📦 Step 1: Migrating Gemini Keys...');

    if (!GeminiKey) {
      console.log('   ⏭️  Legacy GeminiKey model not found — nothing to migrate (already done).');
    }

    const allGeminiKeys = GeminiKey ? await GeminiKey.find({ isActive: true }).lean() : [];
    console.log(`   Found ${allGeminiKeys.length} active Gemini keys`);

    // Group by keyType
    const geminiKeys = allGeminiKeys.filter(k => k.keyType === 'gemini' || !k.keyType);
    const clineKeys = allGeminiKeys.filter(k => k.keyType === 'cline');

    console.log(`   - Gemini keys: ${geminiKeys.length}`);
    console.log(`   - Cline/OpenRouter keys: ${clineKeys.length}`);

    // Create Google Gemini provider
    if (geminiKeys.length > 0) {
      const existingGoogle = await AIProvider.findOne({ providerId: 'google' });
      if (!existingGoogle) {
        const apiKeys = geminiKeys.map((k, i) => ({
          key: encrypt(k.key),
          label: k.label || `Gemini Key ${i + 1} (migrated)`,
          isActive: k.isActive,
          priority: i + 1,
          failCount: k.failCount || 0,
          cooldownUntil: k.cooldownUntil,
          lastUsed: k.lastUsed,
        }));

        await AIProvider.create({
          providerId: 'google',
          name: 'Google Gemini',
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
          isEnabled: true,
          apiKeys,
          selectedModelIds: [
            'gemini-1.5-flash',
            'gemini-1.5-flash-8b',
            'gemini-1.5-pro',
            'gemini-2.0-flash-exp',
            'gemini-2.0-flash-lite',
          ],
          strategy: 'fallback',
          defaultTimeoutMs: 45000,
          defaultRetries: 2,
          createdBy: 'migration',
        });
        console.log(`   ✅ Created Google provider with ${geminiKeys.length} keys`);
      } else {
        console.log(`   ⏭️  Google provider already exists, skipping`);
      }
    }

    // Create OpenRouter provider from Cline keys (sk-or- prefix)
    const openRouterKeys = clineKeys.filter(k => k.key.startsWith('sk-or-'));
    if (openRouterKeys.length > 0) {
      const existingOR = await AIProvider.findOne({ providerId: 'openrouter' });
      if (!existingOR) {
        const apiKeys = openRouterKeys.map((k, i) => ({
          key: encrypt(k.key),
          label: k.label || `OpenRouter Key ${i + 1} (migrated)`,
          isActive: k.isActive,
          priority: i + 1,
          failCount: k.failCount || 0,
          cooldownUntil: k.cooldownUntil,
          lastUsed: k.lastUsed,
        }));

        await AIProvider.create({
          providerId: 'openrouter',
          name: 'OpenRouter',
          baseUrl: 'https://openrouter.ai/api/v1',
          isEnabled: true,
          apiKeys,
          selectedModelIds: [
            'deepseek/deepseek-chat',
            'deepseek/deepseek-v3',
            'qwen/qwen-2.5-vl',
            'meta-llama/llama-3.1-70b-instruct',
            'meta-llama/llama-3.1-8b-instruct',
            'google/gemma-2-9b-it',
            'google/gemini-2.5-flash',
            'openai/gpt-4o-mini',
          ],
          strategy: 'fallback',
          defaultTimeoutMs: 60000,
          defaultRetries: 2,
          createdBy: 'migration',
        });
        console.log(`   ✅ Created OpenRouter provider with ${openRouterKeys.length} keys`);
      } else {
        console.log(`   ⏭️  OpenRouter provider already exists, skipping`);
      }
    }

    // Create Self-hosted provider from other Cline keys
    const customKeys = clineKeys.filter(k => !k.key.startsWith('sk-or-'));
    if (customKeys.length > 0) {
      const existingSH = await AIProvider.findOne({ providerId: 'selfhosted' });
      if (!existingSH) {
        const apiKeys = customKeys.map((k, i) => ({
          key: encrypt(k.key),
          label: k.label || `Custom Key ${i + 1} (migrated)`,
          isActive: k.isActive,
          priority: i + 1,
          failCount: k.failCount || 0,
          cooldownUntil: k.cooldownUntil,
          lastUsed: k.lastUsed,
        }));

        await AIProvider.create({
          providerId: 'selfhosted',
          name: 'Self-hosted Gateway',
          baseUrl: 'http://mc.luckyhub.io.vn:20128/v1',
          isEnabled: true,
          apiKeys,
          selectedModelIds: ['Cline', 'deepseek/deepseek-chat', 'deepseek/deepseek-v3'],
          strategy: 'fallback',
          defaultTimeoutMs: 60000,
          defaultRetries: 3,
          createdBy: 'migration',
        });
        console.log(`   ✅ Created Self-hosted provider with ${customKeys.length} keys`);
      } else {
        console.log(`   ⏭️  Self-hosted provider already exists, skipping`);
      }
    }

    // ==========================================
    // STEP 2: Create Default Task Configurations
    // ==========================================
    console.log('\n📋 Step 2: Creating default task configurations...');

    const defaultTasks = [
      {
        taskType: 'chat',
        providers: [
          { providerId: 'google', strategy: 'fallback', weight: 1, models: ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.0-flash-exp'] },
          { providerId: 'openrouter', strategy: 'fallback', weight: 1, models: ['deepseek/deepseek-chat', 'deepseek/deepseek-v3', 'meta-llama/llama-3.1-70b-instruct'] },
          { providerId: 'selfhosted', strategy: 'fallback', weight: 1, models: ['Cline', 'deepseek/deepseek-chat'] },
        ],
      },
      {
        taskType: 'coach',
        providers: [
          { providerId: 'google', strategy: 'fallback', weight: 1, models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'] },
          { providerId: 'openrouter', strategy: 'fallback', weight: 1, models: ['deepseek/deepseek-chat', 'deepseek/deepseek-v3', 'meta-llama/llama-3.1-70b-instruct'] },
          { providerId: 'selfhosted', strategy: 'fallback', weight: 1, models: ['Cline', 'deepseek/deepseek-chat'] },
        ],
      },
      {
        taskType: 'vision',
        providers: [
          { providerId: 'google', strategy: 'fallback', weight: 1, models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'] },
          { providerId: 'openrouter', strategy: 'fallback', weight: 1, models: ['qwen/qwen-2.5-vl', 'google/gemini-2.5-flash', 'openai/gpt-4o-mini'] },
          { providerId: 'selfhosted', strategy: 'fallback', weight: 1, models: [] },
        ],
      },
      {
        taskType: 'verify',
        providers: [
          { providerId: 'google', strategy: 'fallback', weight: 1, models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'] },
          { providerId: 'openrouter', strategy: 'fallback', weight: 1, models: ['qwen/qwen-2.5-vl', 'google/gemini-2.5-flash', 'openai/gpt-4o-mini'] },
        ],
      },
      {
        taskType: 'food',
        providers: [
          { providerId: 'openrouter', strategy: 'fallback', weight: 1, models: ['google/gemini-2.5-flash', 'openai/gpt-4o-mini', 'google/gemini-2.0-flash-exp'] },
          { providerId: 'google', strategy: 'fallback', weight: 1, models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'] },
        ],
      },
      {
        taskType: 'meal-plan',
        providers: [
          { providerId: 'google', strategy: 'fallback', weight: 1, models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'] },
          { providerId: 'openrouter', strategy: 'fallback', weight: 1, models: ['deepseek/deepseek-chat', 'deepseek/deepseek-v3', 'meta-llama/llama-3.1-70b-instruct'] },
        ],
      },
      {
        taskType: 'embedding',
        providers: [],
      },
    ];

    for (const task of defaultTasks) {
      const existing = await AITaskConfig.findOne({ taskType: task.taskType });
      if (!existing) {
        const providerPriority = [];
        const modelPriority = [];

        for (const p of task.providers) {
          const provider = await AIProvider.findOne({ providerId: p.providerId });
          if (!provider || !provider.isEnabled) continue;

          providerPriority.push({
            providerId: provider._id,
            enabled: true,
            strategy: p.strategy,
            weight: p.weight,
          });

          for (const modelId of p.models) {
            modelPriority.push({
              providerId: provider._id,
              modelId,
              enabled: true,
              apiKeyIndex: -1,
              weight: 1,
            });
          }
        }

        await AITaskConfig.create({
          taskType: task.taskType as any,
          providerPriority,
          modelPriority,
          globalFallbackEnabled: true,
          defaultProviderStrategy: 'fallback',
          updatedBy: 'migration',
        });
        console.log(`   ✅ Created task config: ${task.taskType} (${providerPriority.length} providers, ${modelPriority.length} models)`);
      } else {
        console.log(`   ⏭️  Task config ${task.taskType} already exists, skipping`);
      }
    }

    // ==========================================
    // STEP 3: Discover Models for All Providers
    // ==========================================
    console.log('\n🔍 Step 3: Discovering models from providers...');

    const providers = await AIProvider.find({ isEnabled: true });
    let totalModels = 0;

    for (const provider of providers) {
      try {
        const result = await discoverModelsForProvider(provider);
        totalModels += result.models.length;
        if (result.error) {
          console.warn(`   ⚠️  ${provider.name}: ${result.error}`);
        } else {
          console.log(`   ✅ ${provider.name}: ${result.models.length} models discovered (${result.durationMs}ms)`);
        }
      } catch (err: any) {
        console.error(`   ❌ ${provider.name}: ${err.message}`);
      }
    }

    console.log(`\n   Total models discovered: ${totalModels}`);

    // ==========================================
    // STEP 4: Migrate AIConfig (active_provider)
    // ==========================================
    console.log('\n⚙️  Step 4: Checking AIConfig...');

    const oldConfig = AIConfig ? await AIConfig.findOne({ key: 'active_provider' }) : null;
    if (oldConfig) {
      console.log(`   Found old config: active_provider = ${oldConfig.value}`);
      console.log(`   Note: New system uses task-based provider/model priority instead of single active provider`);
    } else {
      console.log(`   No old AIConfig found`);
    }

    // ==========================================
    // SUMMARY
    // ==========================================
    const duration = Date.now() - startTime;
    console.log('\n✅ ============ MIGRATION COMPLETE ============');
    console.log(`⏱️  Duration: ${duration}ms`);

    const providerCount = await AIProvider.countDocuments();
    const modelCount = await AIModel.countDocuments({ isActive: true });
    const taskCount = await AITaskConfig.countDocuments();

    console.log(`📊 Providers: ${providerCount}`);
    console.log(`📊 Models: ${modelCount}`);
    console.log(`📊 Task Configs: ${taskCount}`);

    console.log('\n📝 Next steps:');
    console.log('   1. Start server: npm run dev');
    console.log('   2. Open Admin Panel → AI Providers tab');
    console.log('   3. Verify providers, keys, and models');
    console.log('   4. Open Admin Panel → Task Mapping tab');
    console.log('   5. Adjust provider/model priority order if needed');
    console.log('   6. Test AI features (chat, vision, food analysis)');
    console.log('\n');

  } catch (err: any) {
    console.error('\n❌ Migration failed:', err);
    throw err;
  }
}

// Allow running directly with: npx tsx scripts/migrate-ai-system.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  connectDB().then(() => migrateAISystem()).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}