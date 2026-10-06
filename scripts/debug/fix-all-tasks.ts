import mongoose from 'mongoose';
import { AITaskConfig } from './server/models/AITaskConfig.ts';
import { AIProvider } from './server/models/AIProvider.ts';
import { AIModel } from './server/models/AIModel.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect('mongodb+srv://vnminenetworkgame_db_user:vsKaIcSSJhfiJYLn@luckyhub.myqla9g.mongodb.net/lucky_hub?retryWrites=true&w=majority', { serverSelectionTimeoutMS: 10000 });

  console.log('=== FIXING ALL TASK CONFIGS ===\n');

  // Get the 9router provider
  const routerProvider = await AIProvider.findOne({ providerId: 'selfhosted', name: '9router' }).lean();
  if (!routerProvider) {
    console.log('ERROR: 9router provider not found');
    process.exit(1);
  }
  const routerProviderId = routerProvider._id.toString();
  console.log('9router provider ID:', routerProviderId);

  // Get all vision-capable models for 9router
  const visionModels = await AIModel.find({
    providerId: routerProviderId,
    'capabilities.vision': true,
    isActive: true
  }).select('modelId displayName isFreeTier').lean();

  // Get all non-vision models for 9router
  const nonVisionModels = await AIModel.find({
    providerId: routerProviderId,
    'capabilities.vision': { $ne: true },
    isActive: true
  }).select('modelId displayName isFreeTier').lean();

  console.log(`Vision models: ${visionModels.length}`);
  console.log(`Non-vision models: ${nonVisionModels.length}`);

  // Fix each task config
  const tasks = [
    { taskType: 'vision', providerId: routerProviderId, models: visionModels, isVisionTask: true },
    { taskType: 'verify', providerId: routerProviderId, models: visionModels, isVisionTask: true },
    { taskType: 'food', providerId: routerProviderId, models: visionModels, isVisionTask: true },
    { taskType: 'chat', providerId: routerProviderId, models: nonVisionModels, isVisionTask: false },
    { taskType: 'coach', providerId: routerProviderId, models: nonVisionModels, isVisionTask: false },
    { taskType: 'meal-plan', providerId: routerProviderId, models: nonVisionModels, isVisionTask: false },
  ];

  for (const task of tasks) {
    console.log(`\n--- Fixing ${task.taskType} ---`);
    
    // Get current config
    const config = await AITaskConfig.findOne({ taskType: task.taskType }).lean();
    
    // Build new provider priority (only 9router)
    const newProviderPriority = [
      { providerId: new mongoose.Types.ObjectId(task.providerId), enabled: true, strategy: 'fallback', weight: 1 }
    ];
    
    // Build new model priority (first 10 models to keep it manageable)
    const modelsToAdd = task.models.slice(0, 10);
    const newModelPriority = modelsToAdd.map((m, i) => ({
      providerId: new mongoose.Types.ObjectId(task.providerId),
      modelId: m.modelId,
      enabled: true,
      apiKeyIndex: -1,
      weight: i + 1
    }));
    
    // Update config
    await AITaskConfig.updateOne(
      { taskType: task.taskType },
      {
        $set: {
          providerPriority: newProviderPriority,
          modelPriority: newModelPriority,
          globalFallbackEnabled: true,
          defaultProviderStrategy: 'fallback'
        }
      }
    );
    
    console.log(`  ✅ Updated ${task.taskType}: ${newModelPriority.length} models`);
    console.log(`  First model: ${newModelPriority[0]?.modelId}`);
    console.log(`  Last model: ${newModelPriority[newModelPriority.length - 1]?.modelId}`);
  }

  console.log('\n=== ALL TASKS FIXED ===');
  process.exit(0);
})();
