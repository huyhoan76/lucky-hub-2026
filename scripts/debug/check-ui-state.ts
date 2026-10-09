import { getMongoUri } from '../mongoUri.ts';
import mongoose from 'mongoose';
import { AITaskConfig } from '../../server/models/AITaskConfig.ts';
import { AIProvider } from '../../server/models/AIProvider.ts';
import { AIModel } from '../../server/models/AIModel.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect(getMongoUri(), { serverSelectionTimeoutMS: 10000 });

  console.log('=== CHECK TASK CONFIG STATES ===\n');
  
  const tasks = ['vision', 'verify', 'food', 'chat', 'coach', 'meal-plan'];
  
  for (const taskType of tasks) {
    const config = await AITaskConfig.findOne({ taskType }).lean();
    console.log(`\n--- Task: ${taskType} ---`);
    console.log('Provider priority:');
    for (const p of config.providerPriority) {
      const provider = await AIProvider.findById(p.providerId).lean();
      console.log(`  ${p.providerId}: ${provider?.name || 'Unknown'} (${p.enabled ? 'enabled' : 'disabled'})`);
    }
    
    console.log('Model priority:');
    if (config.modelPriority && config.modelPriority.length > 0) {
      for (const m of config.modelPriority) {
        const model = await AIModel.findOne({ providerId: m.providerId, modelId: m.modelId }).lean();
        console.log(`  ${m.modelId} từ provider ${m.providerId.toString().substring(0,6)}...`);
        console.log(`    - enabled: ${m.enabled}`);
        console.log(`    - weight: ${m.weight}`);
        if (model) {
          console.log(`    - capabilities.vision: ${model.capabilities?.vision}`);
          console.log(`    - isFreeTier: ${model.isFreeTier}`);
        }
      }
    } else {
      console.log('  (empty - no models configured)');
    }
  }
  
  process.exit(0);
})();
