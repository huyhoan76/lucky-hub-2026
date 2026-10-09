import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { AITaskConfig } from '../../server/models/AITaskConfig.ts';
import { AIModel } from '../../server/models/AIModel.ts';

dotenv.config();

async function checkFoodTask(mongoUri: string): Promise<void> {
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });

  try {
    const config = await AITaskConfig.findOne({ taskType: 'food' }).lean();

    console.log('=== FOOD TASK CONFIG ===');
    console.log('globalFallbackEnabled:', config?.globalFallbackEnabled);
    console.log('providerPriority count:', config?.providerPriority?.length || 0);
    console.log('modelPriority count:', config?.modelPriority?.length);

    if (config?.modelPriority) {
      console.log('Model priorities:');
      config.modelPriority.forEach((model, index) => {
        console.log(
          `${index + 1}. ${model.modelId} from ${model.providerId.toString().substring(0, 8)}... ` +
          `(${model.enabled ? 'enabled' : 'disabled'}, weight: ${model.weight})`
        );
      });
    }

    const firstPriority = config?.modelPriority?.[0];
    if (!firstPriority) return;

    const modelId = firstPriority.modelId;
    const providerId = firstPriority.providerId.toString();
    const model = await AIModel.findOne({
      providerId,
      modelId,
      'capabilities.vision': true,
      isActive: true,
    }).lean();

    console.log('\n=== FOOD MODEL VISION CHECK ===');
    console.log(`Model: ${modelId}`);
    console.log(`Provider: ${providerId}`);
    console.log(`Has vision capability: ${model ? 'YES' : 'NO'}`);
    if (model) {
      console.log(`Vision capabilities: ${JSON.stringify(model.capabilities)}`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('[check-food-task] MONGODB_URI is required to run this diagnostic.');
  process.exitCode = 1;
} else {
  checkFoodTask(mongoUri).catch((error: unknown) => {
    console.error(
      '[check-food-task] Diagnostic failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    process.exitCode = 1;
  });
}
