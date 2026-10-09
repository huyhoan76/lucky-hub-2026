import { getMongoUri } from '../mongoUri.ts';
import mongoose from 'mongoose';
import { getAvailableModelsForTask } from '../../server/services/ai/index.ts';

(async () => {
  await mongoose.connect(getMongoUri(), { serverSelectionTimeoutMS: 10000 });

  const tasks = ['chat', 'coach', 'vision', 'verify', 'food', 'meal-plan'];
  
  for (const taskType of tasks) {
    const models = await getAvailableModelsForTask(taskType as any);
    console.log('\n--- ' + taskType.toUpperCase() + ' ---');
    console.log('Provider: ' + models[0]?.provider);
    if (models[0]?.models) {
      models[0].models.forEach((m: any, i: number) => {
        console.log(i + 1 + '. ' + m.modelId + ' - vision: ' + m.capabilities?.vision + ' - free: ' + m.isFreeTier);
      });
    }
  }
  
  process.exit(0);
})();
