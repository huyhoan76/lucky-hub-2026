import mongoose from 'mongoose';
import { AITaskConfig } from './server/models/AITaskConfig.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect('mongodb+srv://vnminenetworkgame_db_user:vsKaIcSSJhfiJYLn@luckyhub.myqla9g.mongodb.net/lucky_hub?retryWrites=true&w=majority', { serverSelectionTimeoutMS: 10000 });

  const config = await AITaskConfig.findOne({ taskType: 'food' }).lean();
  
  console.log('=== FOOD TASK CONFIG ===');
  console.log('globalFallbackEnabled:', config?.globalFallbackEnabled);
  console.log('providerPriority count:', config?.providerPriority?.length || 0);
  console.log('modelPriority count:', config?.modelPriority?.length);

  if (config?.modelPriority) {
    console.log('Model priorities:');
    config.modelPriority.forEach((m, i) => {
      console.log(`${i+1}. ${m.modelId} from ${m.providerId.toString().substring(0,8)}... enabled:${m.enabled} weight:${m.weight}`);
    });
  }

  process.exit(0);
})();
