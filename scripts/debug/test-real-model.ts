import { getMongoUri } from '../mongoUri.ts';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { callGateway } from '../../server/services/ai/providerGateway.ts';
import { decrypt } from '../../server/utils/encryption.ts';
import mongoose from 'mongoose';
import { AIProvider } from '../../server/models/AIProvider.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect(getMongoUri(), { serverSelectionTimeoutMS: 10000 });
  
  const provider = await AIProvider.findOne({ providerId: 'selfhosted', name: '9router' }).lean();
  const activeKey = provider!.apiKeys.find(k => k.isActive);
  const decryptedKey = decrypt(activeKey!.key);
  
  // Test with an actual model from the gateway
  const modelsToTest = [
    'cl/qwen/qwen-2.5-vl',
    'cl/qwen/qwen3-vl-8b-instruct',
    'cl/qwen/qwen3-vl-32b-instruct',
    'Default',
    'cl/deepseek/deepseek-v4-flash-vision-exp',
    'cl/cline-free/deepseek-v4.1-flash',
  ];
  
  for (const modelId of modelsToTest) {
    console.log(`\n>>> Testing model: ${modelId}`);
    try {
      const result = await callGateway({
        baseUrl: provider!.baseUrl,
        apiKey: decryptedKey,
        model: modelId,
        timeoutMs: 30000,
        retries: 0,
        authType: 'bearer',
      }, [{ role: 'user', content: 'Say hello' }], `test-${modelId}`);
      console.log(`  SUCCESS: ${result.text.substring(0, 100)}`);
    } catch (err: any) {
      console.log(`  ERROR: ${err.message}`);
    }
  }
  
  process.exit(0);
})();
