import mongoose from 'mongoose';
import { AITaskConfig } from './server/models/AITaskConfig.ts';
import { AIModel } from './server/models/AIModel.ts';

(async () => {
  await mongoose.connect('mongodb+srv://vnminenetworkgame_db_user:vsKaIcSSJhfiJYLn@luckyhub.myqla9g.mongodb.net/lucky_hub?retryWrites=true&w=majority', { serverSelectionTimeoutMS: 10000 });

  const config = await AITaskConfig.findOne({ taskType: 'food' }).lean();

  console.log('=== FOOD TASK CONFIG ===');
  console.log('globalFallbackEnabled:', config?.globalFallbackEnabled);
  console.log('providerPriority count:', config?.providerPriority?.length || 0);
  console.log('modelPriority count:', config?.modelPriority?.length);

  if (config?.modelPriority) {
    console.log('Model priorities:');
    config.modelPriority.forEach((m, i) => {
      console.log(`${i+1}. ${m.modelId} from ${m.providerId.toString().substring(0,8)}... (${m.enabled ? 'enabled' : 'disabled'}, weight: ${m.weight})`);
    }
  });

  // Check food task model for vision capability
  if (config?.modelPriority && config.modelPriority.length > 0) {
    const modelId = config.modelPriority[0].modelId;
    const providerId = config.modelPriority[0].providerId.toString();
    
    const model = await AIModel.findOne({ 
      providerId: providerId, 
      modelId: modelId,
      'capabilities.vision': true,
      isActive: true
    }).lean();
    
    console.log('\n=== FOOD MODEL VISION CHECK ===');
    console.log(`Model: ${modelId}`);
    console.log(`Provider: ${providerId}`);
    console.log(`Has vision capability: ${model ? 'YES' : 'NO'}`);
    if (model) {
      console.log(`Vision capabilities: ${JSON.stringify(model.capabilities)}`);
    }
  }

  process.exit(0);
})();
