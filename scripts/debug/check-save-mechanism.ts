import { getMongoUri } from '../mongoUri.ts';
import mongoose from 'mongoose';
import { AITaskConfig } from '../../server/models/AITaskConfig.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect(getMongoUri(), { serverSelectionTimeoutMS: 10000 });

  const tasks = ['vision', 'verify', 'food', 'chat', 'coach', 'meal-plan'];
  
  for (const taskType of tasks) {
    const config = await AITaskConfig.findOne({ taskType }).lean();
    console.log(`\n--- Task: ${taskType} ---`);
    console.log('globalFallbackEnabled:', config?.globalFallbackEnabled);
    console.log('providerPriority count:', config?.providerPriority?.length);
    console.log('modelPriority count:', config?.modelPriority?.length);
    
    if (config?.modelPriority) {
      for (const m of config.modelPriority) {
        console.log(`  - ${m.modelId} from provider ${m.providerId.toString().substring(0,6)}... | enabled:${m.enabled} | weight:${m.weight}`);
      }
    }
  }
  
  process.exit(0);
})();
