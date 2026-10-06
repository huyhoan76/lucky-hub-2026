import mongoose from 'mongoose';
import { AIProvider } from './server/models/AIProvider.ts';
import { getAvailableModelsForTask } from './server/services/ai/index.ts';

(async () => {
  await mongoose.connect('mongodb+srv://vnminenetworkgame_db_user:vsKaIcSSJhfiJYLn@luckyhub.myqla9g.mongodb.net/lucky_hub?retryWrites=true&w=majority', { serverSelectionTimeoutMS: 10000 });

  console.log('=== AVAILABLE MODELS PER TASK ===\n');

  const tasks = ['chat', 'coach', 'vision', 'verify', 'food', 'meal-plan', 'embedding'];
  
  for (const taskType of tasks) {
    const models = await getAvailableModelsForTask(taskType as any);
    console.log(`\n--- ${taskType.toUpperCase()} ---`);
    console.log(`Provider: ${models[0]?.provider || 'N/A'}`);
    console.log('Models:');
    if (models[0]?.models) {
      models[0].models.forEach((m: any, i: number) => {
        console.log(`  ${i+1}. ${m.modelId} - ${m.displayName} - vision: ${m.capabilities?.vision} - free: ${m.isFreeTier}`);
        if (i >= 5) {
          console.log(`  ... and ${models[0].models.length - 6} more`);
          break;
        }
      });
    }
  }
  
  process.exit(0);
})();
