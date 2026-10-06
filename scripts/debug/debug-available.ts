import mongoose from 'mongoose';
import { getAvailableModelsForTask } from './server/services/ai/index.ts';

(async () => {
  await mongoose.connect('mongodb+srv://vnminenetworkgame_db_user:vsKaIcSSJhfiJYLn@luckyhub.myqla9g.mongodb.net/lucky_hub?retryWrites=true&w=majority', { serverSelectionTimeoutMS: 10000 });

  try {
    const tasks = ['vision', 'verify', 'food', 'chat', 'coach', 'meal-plan'];
    
    for (const taskType of tasks) {
      console.log(`\n=== ${taskType.toUpperCase()} ===`);
      try {
        const models = await getAvailableModelsForTask(taskType as any);
        console.log('Success! Got models for', models.length, 'providers');
        if (models.length > 0) {
          console.log('Provider:', models[0].provider);
          console.log('Models count:', models[0].models.length);
          console.log('First 3 models:');
          models[0].models.slice(0, 3).forEach((m: any, idx: number) => {
            console.log(`  ${idx+1}. ${m.modelId} - ${m.displayName || 'N/A'} - vision:${m.capabilities?.vision}`);
          });
        }
      } catch (err) {
        console.log('Error:', err.message);
      }
    }
  } finally {
    process.exit(0);
  }
})();
