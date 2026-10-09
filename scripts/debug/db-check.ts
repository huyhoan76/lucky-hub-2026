import { getMongoUri } from '../mongoUri.ts';
import mongoose from 'mongoose';
import { AIProvider } from '../../server/models/AIProvider.ts';
import { AITaskConfig } from '../../server/models/AITaskConfig.ts';
import { AIModel } from '../../server/models/AIModel.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect(getMongoUri(), { serverSelectionTimeoutMS: 10000 });

  console.log('\n=== Providers ===');
  const providers = await AIProvider.find().lean();
  for (const p of providers) {
    const keys = (p.apiKeys || []).map(k => ({ label: k.label, active: k.isActive, priority: k.priority }));
    console.log(JSON.stringify({
      _id: p._id.toString(), providerId: p.providerId, name: p.name, 
      baseUrl: p.baseUrl, isEnabled: p.isEnabled, 
      selectedModels: p.selectedModelIds,
      apiKeys: keys
    }, null, 2));
  }

  console.log('\n=== Task Configs ===');
  const configs = await AITaskConfig.find().lean();
  for (const c of configs) {
    console.log('---', c.taskType);
    console.log('  providerPriority:', JSON.stringify(c.providerPriority, null, 2));
    console.log('  modelPriority:', JSON.stringify(c.modelPriority, null, 2));
  }

  console.log('\n=== Models (vision-capable) ===');
  const visionModels = await AIModel.find({ 'capabilities.vision': true }).lean();
  console.log(`Total: ${visionModels.length}`);
  for (const m of visionModels) {
    console.log(JSON.stringify({ modelId: m.modelId, displayName: m.displayName, isFreeTier: m.isFreeTier }, null, 2));
  }

  process.exit(0);
})();
