import { getMongoUri } from '../mongoUri.ts';
import mongoose from 'mongoose';
import { AIProvider } from '../../server/models/AIProvider.ts';
import { AITaskConfig } from '../../server/models/AITaskConfig.ts';
import { getAvailableModelsForTask } from '../../server/services/ai/index.ts';

(async () => {
  await mongoose.connect(getMongoUri(), { serverSelectionTimeoutMS: 10000 });

  console.log('=== AVAILABLE MODELS PER TASK ===\n');

  const tasks = ['chat', 'coach', 'vision', 'verify', 'food', 'meal-plan', 'embedding'];
  
  for (const taskType of tasks) {
    const models = await getAvailableModelsForTask(taskType as any);
    console.log(`\n--- ${taskType.toUpperCase()} ---`);
    console.log(`Provider: ${models[0]?.provider || 'N/A'}`);
    console.log('Models:');
    if (models[0]?.models) {
      for (const [i, m] of models[0].models.entries()) {
        console.log(`  ${i+1}. ${m.modelId} - ${m.displayName} - vision: ${m.capabilities?.vision} - free: ${m.isFreeTier}`);
        if (i >= 5) {
          console.log(`  ... and ${models[0].models.length - 6} more`);
          break;
        }
      }
    }
  }
  
  process.exit(0);
})();
