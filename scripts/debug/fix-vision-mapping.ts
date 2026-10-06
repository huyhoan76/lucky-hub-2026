import mongoose from 'mongoose';
import { AIProvider } from './server/models/AIProvider.ts';
import { AITaskConfig } from './server/models/AITaskConfig.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect('mongodb+srv://vnminenetworkgame_db_user:vsKaIcSSJhfiJYLn@luckyhub.myqla9g.mongodb.net/lucky_hub?retryWrites=true&w=majority', { serverSelectionTimeoutMS: 10000 });

  // Lấy provider 9router (selfhosted)
  const routerProvider = await AIProvider.findOne({ providerId: 'selfhosted', name: '9router' }).lean();
  if (!routerProvider) {
    console.log('❌ Provider 9router không tìm thấy');
    process.exit(1);
  }
  const routerProviderId = routerProvider._id.toString();
  console.log(`✅ Provider 9router: ${routerProviderId}`);

  // Lấy provider google (nếu có)
  const googleProvider = await AIProvider.findOne({ providerId: 'google' }).lean();
  const googleProviderId = googleProvider?._id.toString() || null;
  console.log(`✅ Provider google: ${googleProviderId || 'không tồn tại'}`);

  // Cập nhật task config cho vision, verify, food
  const tasksToFix = ['vision', 'verify', 'food'];
  
  for (const taskType of tasksToFix) {
    const config = await AITaskConfig.findOne({ taskType }).lean();
    if (!config) {
      console.log(`⚠️ Task config ${taskType} không tồn tại`);
      continue;
    }

    console.log(`\n--- Cập nhật task config: ${taskType} ---`);
    console.log(`  Provider priority: ${config.providerPriority.map(p => `${p.providerId.toString().substring(0,8)}...`).join(', ')}`);
    console.log(`  Model priority trước: ${config.modelPriority.map(m => `${m.providerId.toString().substring(0,8)}... → ${m.modelId}`).join(', ')}`);

    // Sửa providerId trong modelPriority: thay google bằng 9router nếu model không thuộc google
    const updatedModelPriority = config.modelPriority.map(m => {
      // Nếu modelId là 9router-vision hoặc claude-3-5-sonnet-20241022, đổi provider sang 9router
      if (['9router-vision', 'claude-3-5-sonnet-20241022'].includes(m.modelId)) {
        return { ...m, providerId: new mongoose.Types.ObjectId(routerProviderId) };
      }
      // Nếu providerId là google và model không phải của google, đổi sang 9router
      if (googleProviderId && m.providerId.toString() === googleProviderId) {
        // Kiểm tra xem model có thực sự thuộc google không
        // Nếu modelId bắt đầu bằng "cl/" hoặc "9router" hoặc "claude", thì đổi sang 9router
        if (m.modelId.startsWith('cl/') || m.modelId === '9router-vision' || m.modelId === 'claude-3-5-sonnet-20241022') {
          return { ...m, providerId: new mongoose.Types.ObjectId(routerProviderId) };
        }
      }
      return m;
    });

    await AITaskConfig.updateOne(
      { taskType },
      { $set: { modelPriority: updatedModelPriority, updatedAt: new Date() } }
    );
    console.log(`  Model priority sau: ${updatedModelPriority.map(m => `${m.providerId.toString().substring(0,8)}... → ${m.modelId}`).join(', ')}`);
    console.log(`  ✅ Đã cập nhật task config ${taskType}`);
  }

  // Cập nhật selectedModelIds của provider 9router
  const currentSelected = routerProvider.selectedModelIds || [];
  const modelsToAdd = ['9router-vision', 'claude-3-5-sonnet-20241022'].filter(m => !currentSelected.includes(m));
  
  if (modelsToAdd.length > 0) {
    await AIProvider.updateOne(
      { _id: routerProviderId },
      { $push: { selectedModelIds: { $each: modelsToAdd } } }
    );
    console.log(`\n✅ Đã thêm models vào provider 9router: ${modelsToAdd.join(', ')}`);
  } else {
    console.log(`\n✅ Provider 9router đã có đủ models: ${currentSelected.join(', ')}`);
  }

  console.log('\n✅ Hoàn tất sửa task mapping cho vision/verify/food');
  process.exit(0);
})();
