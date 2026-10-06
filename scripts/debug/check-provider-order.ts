import mongoose from 'mongoose';
import { AITaskConfig } from './server/models/AITaskConfig.ts';
import { AIProvider } from './server/models/AIProvider.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect('mongodb+srv://vnminenetworkgame_db_user:vsKaIcSSJhfiJYLn@luckyhub.myqla9g.mongodb.net/lucky_hub?retryWrites=true&w=majority', { serverSelectionTimeoutMS: 10000 });

  const tasks = ['vision', 'verify', 'food', 'chat', 'coach', 'meal-plan'];
  
  for (const taskType of tasks) {
    const config = await AITaskConfig.findOne({ taskType }).lean();
    console.log(`\n=== ${taskType.toUpperCase()} ===`);
    console.log('Provider Priority (in order):');
    if (config?.providerPriority) {
      for (const p of config.providerPriority) {
        const provider = await AIProvider.findById(p.providerId).lean();
        console.log(`  ${p.providerId.toString().substring(0,8)}... ${provider?.name || 'Unknown'} (weight:${p.weight}, enabled:${p.enabled}, strategy:${p.strategy})`);
      }
    }
    console.log('Model Priority:');
    if (config?.modelPriority) {
      for (const m of config.modelPriority) {
        const provider = await AIProvider.findById(m.providerId).lean();
        console.log(`  ${m.modelId} from ${m.providerId.toString().substring(0,8)}... (provider:${provider?.name || 'Unknown'} enabled:${m.enabled} weight:${m.weight})`);
      }
    }
  }
  process.exit(0);
})();
