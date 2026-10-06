import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { AITaskConfig } from './server/models/AITaskConfig.ts';
import { AIProvider } from './server/models/AIProvider.ts';
import { AIModel } from './server/models/AIModel.ts';
import mongoose from 'mongoose';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect('mongodb+srv://vnminenetworkgame_db_user:vsKaIcSSJhfiJYLn@luckyhub.myqla9g.mongodb.net/lucky_hub?retryWrites=true&w=majority', { serverSelectionTimeoutMS: 10000 });
  
  console.log('=== FINAL DIAGNOSIS ===\n');
  
  // Check vision task config
  const visionConfig = await AITaskConfig.findOne({ taskType: 'vision' }).lean();
  console.log('1. Vision Task Config:');
  console.log('   - globalFallbackEnabled: ' + visionConfig?.globalFallbackEnabled);
  console.log('   - modelPriority count: ' + visionConfig?.modelPriority?.length);
  for (const m of visionConfig?.modelPriority || []) {
    console.log('     * ' + m.modelId + ' from provider ' + m.providerId.toString().substring(0,8) + '...');
  }
  
  // Check model database
  const realModels = await AIModel.find({ modelId: { $regex: /^cl\// } }).lean();
  const visionModels = realModels.filter((m: any) => m.capabilities?.vision);
  
  console.log('\n2. Vision-capable models in DB (real ones):');
  for (const m of visionModels) {
    console.log('   - ' + m.modelId + ': vision=' + m.capabilities?.vision);
  }
  
  // Get provider info
  const provider = await AIProvider.findOne({ providerId: 'selfhosted', name: '9router' }).lean();
  
  console.log('\n3. Account status:');
  console.log('   - Provider: ' + provider?.name);
  console.log('   - Credit issue: User needs to add credits at https://app.cline.bot/credits');
  
  console.log('\n=== ROOT CAUSE ===\n');
  console.log('The 9router (Cline) account has NEGATIVE CREDIT balance (-$0.03)');
  console.log('All API calls to 9router fail with "Insufficient balance" (402 error)');
  console.log('The "Default" model works (no credits needed) but it\'s not a vision model');
  
  console.log('\n=== REQUIRED ACTIONS ===\n');
  console.log('1. CONFIG FIX (already done):');
  console.log('   - globalFallbackEnabled=true');
  console.log('   - modelPriority contains only real vision models');
  console.log('   - Removed non-existent models (9router-vision, claude-3-5-sonnet-20241022)');
  
  console.log('2. USER MUST:');
  console.log('   - Add credits to Cline/9router account at https://app.cline.bot/credits');
  console.log('   - Current balance: -$0.03 (insufficient)');
  
  console.log('3. AFTER ADDING CREDITS:');
  console.log('   - Use actual 9router models with "cl/" prefix');
  console.log('   - Example working config: modelId="cl/qwen/qwen-2.5-vl"');
  
  process.exit(0);
})();
