import mongoose from 'mongoose';
import { User } from './server/models/User.ts';
import { ActiveSession } from './server/models/ActiveSession.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect('mongodb+srv://vnminenetworkgame_db_user:vsKaIcSSJhfiJYLn@luckyhub.myqla9g.mongodb.net/lucky_hub?retryWrites=true&w=majority', { serverSelectionTimeoutMS: 10000 });

  console.log('Database providers:');
  const providers = await AIProvider.find({}).lean();
  for (const p of providers) {
    console.log(`  ${p._id}: ${p.name} (${p.providerId}) enabled:${p.isEnabled}`);
  }
  
  // Also check what providers are referenced in task configs
  const { AITaskConfig } = require('./server/models/AITaskConfig.ts');
  const tasks = ['vision', 'verify', 'food', 'chat', 'coach', 'meal-plan'];
  
  console.log('\nTask configs reference:');
  for (const taskType of tasks) {
    const config = await AITaskConfig.findOne({ taskType }).lean();
    console.log(`  ${taskType}: providerPriority=[${config?.providerPriority?.map(p => p.providerId.toString().substring(0,6))?.join(', ') || 'empty'}]`);
  }
  
  process.exit(0);
})();
