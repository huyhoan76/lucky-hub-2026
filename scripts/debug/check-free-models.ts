import mongoose from 'mongoose';
import { AIModel } from './server/models/AIModel.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect('mongodb+srv://vnminenetworkgame_db_user:vsKaIcSSJhfiJYLn@luckyhub.myqla9g.mongodb.net/lucky_hub?retryWrites=true&w=majority', { serverSelectionTimeoutMS: 10000 });
  
  // Find all free vision models
  const freeVisionModels = await AIModel.find({ 
    isFreeTier: true, 
    'capabilities.vision': true 
  }).select('modelId providerId displayName').lean();
  
  console.log('=== FREE VISION MODELS ===');
  console.log(`Total: ${freeVisionModels.length}`);
  
  // Group by provider
  const byProvider: any = {};
  for (const model of freeVisionModels) {
    const providerId = model.providerId.toString();
    if (!byProvider[providerId]) {
      byProvider[providerId] = [];
    }
    byProvider[providerId].push(model);
  }
  
  for (const providerId in byProvider) {
    console.log(`\nProvider ${providerId}:`);
    for (const model of byProvider[providerId]) {
      console.log(`  - ${model.modelId} (${model.displayName})`);
    }
  }
  
  process.exit(0);
})();
