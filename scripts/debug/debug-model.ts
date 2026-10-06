import mongoose from 'mongoose';
import { AIProvider } from './server/models/AIProvider.ts';
import { AIModel } from './server/models/AIModel.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect('mongodb+srv://vnminenetworkgame_db_user:vsKaIcSSJhfiJYLn@luckyhub.myqla9g.mongodb.net/lucky_hub?retryWrites=true&w=majority', { serverSelectionTimeoutMS: 10000 });
  
  // Get provider ID for 9router
  const provider = await AIProvider.findOne({ providerId: 'selfhosted', name: '9router' }).select('_id').lean();
  console.log('Provider ID:', provider?._id.toString());
  
  // Query without capabilities filter
  const models = await AIModel.find({ 
    providerId: provider?._id.toString(),
    modelId: 'cl/inclusionai/ling-3.0-flash-vl:free'
  }).select('modelId capabilities isFreeTier').lean();
  
  console.log('Models found:', JSON.stringify(models, null, 2));
  
  // Query with capabilities.vision true
  const visionModels = await AIModel.find({ 
    providerId: provider?._id.toString(),
    'capabilities.vision': true,
    modelId: 'cl/inclusionai/ling-3.0-flash-vl:free'
  }).select('modelId capabilities isFreeTier').lean();
  
  console.log('Vision models found:', JSON.stringify(visionModels, null, 2));
  
  process.exit(0);
})();
