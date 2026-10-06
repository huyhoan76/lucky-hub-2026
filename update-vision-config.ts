import mongoose from 'mongoose';
import { AITaskConfig } from './server/models/AITaskConfig.ts';
import { AIProvider } from './server/models/AIProvider.ts';
import { AIModel } from './server/models/AIModel.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect('mongodb+srv://vnminenetworkgame_db_user:vsKaIcSSJhfiJYLn@luckyhub.myqla9g.mongodb.net/lucky_hub?retryWrites=true&w=majority', { serverSelectionTimeoutMS: 10000 });
  
  // Get provider ID for 9router
  const provider = await AIProvider.findOne({ providerId: 'selfhosted', name: '9router' }).select('_id').lean();
  const routerProviderId = provider?._id.toString();
  
  // Find the free vision model
  const freeModel = await AIModel.findOne({ 
    providerId: routerProviderId,
    modelId: 'cl/inclusionai/ling-3.0-flash-vl:free',
    'capabilities.vision': true,
    isActive: true
  }).select('modelId capabilities').lean();
  
  console.log('=== FREE VISION MODEL FOUND ===');
  console.log(JSON.stringify(freeModel, null, 2));
  
  if (!freeModel) {
    console.log('ERROR: Free vision model not found!');
    process.exit(1);
  }
  
  // Update vision task config to use free model
  await AITaskConfig.updateOne(
    { taskType: 'vision' },
    {
      $set: {
        globalFallbackEnabled: true,
        modelPriority: [
          { providerId: new mongoose.Types.ObjectId(routerProviderId), modelId: freeModel.modelId, enabled: true, apiKeyIndex: -1, weight: 1 }
        ]
      }
    }
  );
  
  console.log(`\n✅ Updated vision task config to use free model: ${freeModel.modelId}`);
  
  // Also update verify and food
  for (const taskType of ['verify', 'food']) {
    await AITaskConfig.updateOne(
      { taskType },
      {
        $set: {
          globalFallbackEnabled: true,
          modelPriority: [
            { providerId: new mongoose.Types.ObjectId(routerProviderId), modelId: freeModel.modelId, enabled: true, apiKeyIndex: -1, weight: 1 }
          ]
        }
      }
    );
    console.log(`✅ Updated ${taskType} task config`);
  }
  
  process.exit(0);
})();
