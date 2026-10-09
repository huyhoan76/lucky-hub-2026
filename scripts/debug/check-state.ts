import { getMongoUri } from '../mongoUri.ts';
import mongoose from 'mongoose';
import { AITaskConfig } from '../../server/models/AITaskConfig.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect(getMongoUri(), { serverSelectionTimeoutMS: 10000 });

  const tasks = ['vision', 'verify', 'food', 'chat', 'coach', 'meal-plan'];
  
  for (const taskType of tasks) {
    const config = await AITaskConfig.findOne({ taskType }).lean();
    console.log('=== ' + taskType.toUpperCase() + ' ===');
    console.log('Provider priority count:', config?.providerPriority?.length || 0);
    console.log('Model priority count:', config?.modelPriority?.length);
    
    if (config?.modelPriority) {
      config.modelPriority.forEach((m, i) => {
        console.log(i+1 + '. ' + m.modelId + ' from ' + m.providerId.toString().substring(0,8) + '... enabled:' + m.enabled + ' weight:' + m.weight);
      });
    }
  }
  
  process.exit(0);
})();
