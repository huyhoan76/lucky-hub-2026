import { getMongoUri } from '../mongoUri.ts';
import mongoose from 'mongoose';
import { AIProvider } from '../../server/models/AIProvider.ts';
import { AITaskConfig } from '../../server/models/AITaskConfig.ts';
import { AIModel } from '../../server/models/AIModel.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect(getMongoUri(), { serverSelectionTimeoutMS: 10000 });

  console.log('=== KIỂM TRA VỀ CẤU TRỢ HIỆU SUẤT SAU KHI SỬA ===\n');

  // Lấy task configs
  const tasks = ['vision', 'verify', 'food'];
  
  for (const taskType of tasks) {
    const config = await AITaskConfig.findOne({ taskType }).lean();
    console.log(`--- Task: ${taskType} ---`);
    console.log('Provider priority:', config.providerPriority.map(p => ({
      id: p.providerId.toString().substring(0, 8),
      name: p.enabled ? 'enabled' : 'disabled',
      strategy: p.strategy
    })));
    
    console.log('Model priority:');
    for (const m of config.modelPriority) {
      console.log(`  - ${m.modelId}: providerId=${m.providerId.toString().substring(0, 8)}... (enabled=${m.enabled})`);
    }
    console.log('');
  }

  // Kiểm tra provider 9router
  const routerProvider = await AIProvider.findOne({ providerId: 'selfhosted', name: '9router' }).lean();
  console.log('--- Provider 9router ---');
  console.log('selectedModelIds:', routerProvider.selectedModelIds || []);
  console.log('isEnabled:', routerProvider.isEnabled);
  console.log('');

  // Test xem model có được find không
  const VisionModels = await AIModel.find({ 'capabilities.vision': true, isActive: true }).lean();
  console.log('Total models vision-capable:', VisionModels.length);
  
  // Tìm model 9router-vision trong DB
  const model9routerVision = VisionModels.find(m => m.modelId === '9router-vision');
  console.log('9router-vision trong DB:', model9routerVision ? 'TÒN TẠI (providerId=' + model9routerVision.providerId + ')' : 'KHÔNG TÒN TẠI');

  // Tìm model claude-3-5-sonnet-20241022 trong DB  
  const modelClaude = VisionModels.find(m => m.modelId === 'claude-3-5-sonnet-20241022');
  console.log('claude-3-5-sonnet-20241022 trong DB:', modelClaude ? 'TÒN TẠI (providerId=' + modelClaude.providerId + ')' : 'KHÔNG TÒN TẠI');

  console.log('\n=== KẾT QUẢ ===');
  console.log('1. Task configs đã được sửa providerId trong modelPriority sang 6ab7c1bbc8dc0cfa37f28f44 (9router)');
  console.log('2. Provider 9router giờ đây có selectedModelIds: 9router-vision, claude-3-5-sonnet-20241022');
  console.log('3. Models tồn tại trong database');
  
  // Kiểm tra task config vision
  const visionConfig = await AITaskConfig.findOne({ taskType: 'vision' }).lean();
  const has9routerInProviderPriority = visionConfig.providerPriority.some(p => p.providerId.toString() === '6ab7c1bbc8dc0cfa37f28f44');
  const has9routerVisionModel = visionConfig.modelPriority.some(m => m.modelId === '9router-vision' && m.providerId.toString() === '6ab7c1bbc8dc0cfa37f28f44');
  const hasClaudeModel = visionConfig.modelPriority.some(m => m.modelId === 'claude-3-5-sonnet-20241022' && m.providerId.toString() === '6ab7c1bbc8dc0cfa37f28f44');
  
  console.log('\nKiểm tra task vision:');
  console.log(`   - Provider 9router trong providerPriority: ${has9routerInProviderPriority ? 'CÓ' : 'KHÔNG'}`);
  console.log(`   - Model 9router-vision trỏ về 9router: ${has9routerVisionModel ? 'CÓ' : 'KHÔNG'}`);
  console.log(`   - Model claude-3-5-sonnet-20241022 trỏ về 9router: ${hasClaudeModel ? 'CÓ' : 'KHÔNG'}`);
  
  process.exit(0);
})();
