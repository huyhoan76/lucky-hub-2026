import { getMongoUri } from '../mongoUri.ts';
import mongoose from 'mongoose';
import { AITaskConfig } from '../../server/models/AITaskConfig.ts';
import { AIModel } from '../../server/models/AIModel.ts';
import { AIProvider } from '../../server/models/AIProvider.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect(getMongoUri(), { serverSelectionTimeoutMS: 10000 });

  console.log('=== TASK CONFIG VISION ===');
  const visionConfig = await AITaskConfig.findOne({ taskType: 'vision' }).lean();
  console.log(JSON.stringify({
    globalFallbackEnabled: visionConfig?.globalFallbackEnabled,
    providerPriority: visionConfig?.providerPriority,
    modelPriority: visionConfig?.modelPriority,
    defaultProviderStrategy: visionConfig?.defaultProviderStrategy,
  }, null, 2));

  console.log('\n=== MODEL 9router-vision ===');
  const model9router = await AIModel.findOne({ modelId: '9router-vision' }).lean();
  console.log(JSON.stringify({
    _id: model9router?._id,
    providerId: model9router?.providerId,
    modelId: model9router?.modelId,
    capabilities: model9router?.capabilities,
    isActive: model9router?.isActive,
    isFreeTier: model9router?.isFreeTier,
  }, null, 2));

  console.log('\n=== MODEL claude-3-5-sonnet-20241022 ===');
  const modelClaude = await AIModel.findOne({ modelId: 'claude-3-5-sonnet-20241022' }).lean();
  console.log(JSON.stringify({
    _id: modelClaude?._id,
    providerId: modelClaude?.providerId,
    modelId: modelClaude?.modelId,
    capabilities: modelClaude?.capabilities,
    isActive: modelClaude?.isActive,
    isFreeTier: modelClaude?.isFreeTier,
  }, null, 2));

  console.log('\n=== PROVIDER 9router ===');
  const routerProvider = await AIProvider.findOne({ providerId: 'selfhosted', name: '9router' }).lean();
  console.log(JSON.stringify({
    _id: routerProvider?._id,
    providerId: routerProvider?.providerId,
    name: routerProvider?.name,
    baseUrl: routerProvider?.baseUrl,
    isEnabled: routerProvider?.isEnabled,
    selectedModelIds: routerProvider?.selectedModelIds,
    apiKeys: routerProvider?.apiKeys?.map((k: any) => ({ label: k.label, active: k.isActive })),
  }, null, 2));

  process.exit(0);
})();
