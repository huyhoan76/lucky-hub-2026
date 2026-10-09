import { getMongoUri } from '../mongoUri.ts';
import mongoose from 'mongoose';
import { AITaskConfig } from '../../server/models/AITaskConfig.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect(getMongoUri(), { serverSelectionTimeoutMS: 10000 });

  // Update vision task config
  await AITaskConfig.updateOne(
    { taskType: 'vision' },
    {
      $set: {
        globalFallbackEnabled: true,
        // Keep only vision-capable models in modelPriority
        modelPriority: [
          { providerId: new mongoose.Types.ObjectId('6ab7c1bbc8dc0cfa37f28f44'), modelId: '9router-vision', enabled: true, apiKeyIndex: -1, weight: 1 }
          // Note: claude-3-5-sonnet-20241022 is not vision-capable, so removed from vision task
        ]
      }
    }
  );

  console.log('✅ Updated vision task config: globalFallbackEnabled=true, modelPriority filtered to vision-capable models only');

  // Also update verify and food tasks similarly? They also use vision
  const tasks = ['verify', 'food'];
  for (const taskType of tasks) {
    await AITaskConfig.updateOne(
      { taskType },
      {
        $set: {
          globalFallbackEnabled: true,
          modelPriority: [
            { providerId: new mongoose.Types.ObjectId('6ab7c1bbc8dc0cfa37f28f44'), modelId: '9router-vision', enabled: true, apiKeyIndex: -1, weight: 1 }
          ]
        }
      }
    );
    console.log(`✅ Updated ${taskType} task config`);
  }

  process.exit(0);
})();
