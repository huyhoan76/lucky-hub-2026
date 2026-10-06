import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { callGateway } from './server/services/ai/providerGateway.ts';
import { decrypt } from './server/utils/encryption.ts';
import mongoose from 'mongoose';
import { AIProvider } from './server/models/AIProvider.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect('mongodb+srv://vnminenetworkgame_db_user:vsKaIcSSJhfiJYLn@luckyhub.myqla9g.mongodb.net/lucky_hub?retryWrites=true&w=majority', { serverSelectionTimeoutMS: 10000 });
  
  const provider = await AIProvider.findOne({ providerId: 'selfhosted', name: '9router' }).lean();
  if (!provider) {
    console.log('Provider not found');
    return;
  }
  
  const activeKey = provider.apiKeys.find(k => k.isActive);
  if (!activeKey) {
    console.log('No active key');
    return;
  }
  
  const decryptedKey = decrypt(activeKey.key);
  console.log(`Using key: ${decryptedKey.substring(0, 20)}...${decryptedKey.substring(decryptedKey.length - 10)}`);
  
  const gatewayConfig = {
    baseUrl: provider.baseUrl,
    apiKey: decryptedKey,
    model: '9router-vision',
    timeoutMs: 60000,
    retries: 3,
    authType: 'bearer',
  };
  
  const messages = [{ role: 'user', content: 'Say hello' }];
  const requestId = 'direct-test';
  
  console.log('Calling gateway...');
  try {
    const result = await callGateway(gatewayConfig, messages, requestId);
    console.log('Success:', result);
  } catch (err: any) {
    console.log('Error:', err.message);
    if (err.status) console.log('Status:', err.status);
  }
  
  process.exit(0);
})();
