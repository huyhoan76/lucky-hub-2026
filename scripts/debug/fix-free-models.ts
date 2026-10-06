import mongoose from 'mongoose';
import { AIModel } from './server/models/AIModel.ts';
import { AIProvider } from './server/models/AIProvider.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect('mongodb+srv://vnminenetworkgame_db_user:vsKaIcSSJhfiJYLn@luckyhub.myqla9g.mongodb.net/lucky_hub?retryWrites=true&w=majority', { serverSelectionTimeoutMS: 10000 });
  
  // Get provider ID for 9router
  const provider = await AIProvider.findOne({ providerId: 'selfhosted', name: '9router' }).select('_id').lean();
  const routerProviderId = provider?._id.toString();
  
  // Find ALL vision models for 9router provider that have ":free" in their ID
  const freeVisionModels = await AIModel.find({ 
    providerId: routerProviderId,
    modelId: { $regex: /:free$/i },
    'capabilities.vision': true
  }).select('modelId isFreeTier').lean();
  
  console.log('=== MODELS WITH ":free" SUFFIX ===');
  for (const model of freeVisionModels) {
    console.log(`${model.modelId} | isFreeTier=${model.isFreeTier}`);
  }
  
  // Update isFreeTier to true for these models
  for (const model of freeVisionModels) {
    await AIModel.updateOne(
      { _id: model._id },
      { $set: { isFreeTier: true } }
    );
    console.log(`Updated: ${model.modelId} → isFreeTier=true`);
  }
  
  console.log(`\nTotal updated: ${freeVisionModels.length}`);
  
  process.exit(0);
})();
