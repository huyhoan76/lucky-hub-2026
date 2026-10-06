import mongoose from 'mongoose';
import { AITaskConfig } from './server/models/AITaskConfig.ts';
import { AIProvider } from './server/models/AIProvider.ts';
import { AIModel } from './server/models/AIModel.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect('mongodb+srv://vnminenetworkgame_db_user:vsKaIcSSJhfiJYLn@luckyhub.myqla9g.mongodb.net/lucky_hub?retryWrites=true&w=majority', { serverSelectionTimeoutMS: 10000 });

  const tasks = ['vision', 'verify', 'food', 'chat', 'coach', 'meal-plan'];
  
  for (const taskType of tasks) {
    const config = await AITaskConfig.findOne({ taskType }).lean();
    console.log(`\n=== ${taskType.toUpperCase()} ===`);
    console.log('globalFallbackEnabled:', config?.globalFallbackEnabled);
    console.log('providerPriority count:', config?.providerPriority?.length || 0);
    console.log('modelPriority count:', config?.modelPriority?.length);
    
    if (config?.modelPriority) {
      console.log('Model Priority:');
      config.modelPriority.forEach((m, i) => {
        console.log(`  ${i+1}. ${m.modelId} from ${m.providerId.toString().substring(0,8)}... enabled:${m.enabled} weight:${m.weight}`);
      });
    } else {
      console.log('  (empty)');
    }
  }
  
  // Check available models per provider
  console.log('\n=== AVAILABLE MODELS PER PROVIDER ===');
  const providers = await AIProvider.find({ isEnabled: true }).lean();
  for (const p of providers) {
    console.log(`\nProvider: ${p.name} (${p.providerId})`);
    console.log(`  selectedModelIds: ${p.selectedModelIds?.join(', ') || 'none'}`);
    
    const models = await AIModel.find({ providerId: p._id, isActive: true }).select('modelId capabilities displayName').lean();
    console.log(`  Total active models: ${models.length}`);
    const visionModels = models.filter(m => m.capabilities?.vision);
    console.log(`  Vision models: ${visionModels.length}`);
    const nonVisionModels = models.filter(m => !m.capabilities?.vision);
    console.log(`  Non-vision models: ${nonVisionModels.length}`);
    
    // Show first few of each
    console.log('  First 3 vision:');
    visionModels.slice(0, 3).forEach(m => console.log(`    - ${m.modelId} (${m.displayName})`));
    console.log('  First 3 non-vision:');
    nonVisionModels.slice(0, 3).forEach(m => console.log(`    - ${m.modelId} (${m.displayName})`));
  }

  process.exit(0);
})();
