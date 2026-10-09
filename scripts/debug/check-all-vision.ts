import { getMongoUri } from '../mongoUri.ts';
import mongoose from 'mongoose';
import { AIModel } from '../../server/models/AIModel.ts';
import { AIProvider } from '../../server/models/AIProvider.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect(getMongoUri(), { serverSelectionTimeoutMS: 10000 });
  
  // Get provider ID for 9router
  const provider = await AIProvider.findOne({ providerId: 'selfhosted', name: '9router' }).select('_id').lean();
  const routerProviderId = provider?._id.toString();
  
  // Find ALL vision models for 9router provider
  const visionModels = await AIModel.find({ 
    providerId: routerProviderId,
    'capabilities.vision': true,
    isActive: true
  }).select('modelId displayName isFreeTier').lean();
  
  console.log('=== ALL VISION MODELS FROM 9router PROVIDER ===');
  console.log(`Total: ${visionModels.length}`);
  
  // Show first 30 models
  for (const model of visionModels.slice(0, 30)) {
    const freeTag = model.isFreeTier ? '🆓 FREE' : '💰 PAID';
    console.log(`  ${freeTag} ${model.modelId} (${model.displayName})`);
  }
  
  // Show all FREE models
  const freeModels = visionModels.filter(m => m.isFreeTier);
  console.log(`\n=== FREE VISION MODELS: ${freeModels.length} ===`);
  for (const model of freeModels) {
    console.log(`  ${model.modelId}`);
  }
  
  // Show models with ":free" in ID
  const freeIdModels = visionModels.filter(m => m.modelId.toLowerCase().includes(':free'));
  console.log(`\n=== Models with ":free" suffix: ${freeIdModels.length} ===`);
  for (const model of freeIdModels) {
    console.log(`  ${model.modelId} (isFreeTier: ${model.isFreeTier})`);
  }
  
  process.exit(0);
})();
