import { getMongoUri } from '../mongoUri.ts';
import mongoose from 'mongoose';
import { AITaskConfig } from '../../server/models/AITaskConfig.ts';
import { AIProvider } from '../../server/models/AIProvider.ts';
import { AIModel } from '../../server/models/AIModel.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect(getMongoUri(), { serverSelectionTimeoutMS: 10000 });

  // Get provider ID for 9router
  const routerProvider = await AIProvider.findOne({ providerId: 'selfhosted', name: '9router' }).select('_id').lean();
  const routerProviderId = routerProvider?._id.toString();

  // Get Google provider ID
  const googleProvider = await AIProvider.findOne({ providerId: 'google' }).select('_id').lean();
  const googleProviderId = googleProvider?._id.toString();

  console.log('Router provider ID:', routerProviderId);
  console.log('Google provider ID:', googleProviderId);

  // Get vision-capable models for 9router
  const visionModels = await AIModel.find({
    providerId: routerProviderId,
    'capabilities.vision': true,
    isActive: true
  }).select('modelId displayName isFreeTier').lean();

  console.log(`\nVision models available for 9router: ${visionModels.length}`);
  for (const m of visionModels) {
    console.log(`  - ${m.modelId} (FREE: ${m.isFreeTier})`);
  }

  // Update vision task config
  const visionConfig = await AITaskConfig.findOne({ taskType: 'vision' }).lean();
  console.log('\nVision config before:', JSON.stringify({
    providerPriority: visionConfig?.providerPriority?.map(p => p.providerId.toString().substring(0,6)),
    modelPriority: visionConfig?.modelPriority?.map(m => m.modelId)
  }, null, 2));

  await AITaskConfig.updateOne(
    { taskType: 'vision' },
    {
      $set: {
        modelPriority: visionModels.map((m, i) => ({
          providerId: new mongoose.Types.ObjectId(routerProviderId),
          modelId: m.modelId,
          enabled: true,
          apiKeyIndex: -1,
          weight: i + 1
        })),
        globalFallbackEnabled: true
      }
    }
  );

  console.log('\n✅ Updated vision task config with', visionModels.length, 'models');

  // Verify
  const updatedConfig = await AITaskConfig.findOne({ taskType: 'vision' }).lean();
  console.log('\nVision config after:', JSON.stringify({
    modelPriority: updatedConfig?.modelPriority?.map(m => m.modelId)
  }, null, 2));

  process.exit(0);
})();
