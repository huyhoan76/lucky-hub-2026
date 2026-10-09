import { getMongoUri } from './scripts/mongoUri.ts';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';
import { AIProvider } from './server/models/AIProvider.ts';
import { decrypt } from './server/utils/encryption.ts';
import { listModels } from './server/services/ai/providerGateway.ts';
import { getProviderDefinition } from './server/config/aiProviders.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect(getMongoUri(), { serverSelectionTimeoutMS: 10000 });
  
  const provider = await AIProvider.findOne({ providerId: 'selfhosted', name: '9router' }).lean();
  if (!provider) {
    console.log('Provider not found');
    return;
  }
  
  const activeKey = provider.apiKeys.find(k => k.isActive);
  const decryptedKey = decrypt(activeKey!.key);
  const def = getProviderDefinition('selfhosted');
  
  console.log('Listing models from 9router...');
  try {
    const models = await listModels({
      baseUrl: provider.baseUrl,
      apiKey: decryptedKey,
      model: '',
      timeoutMs: 30000,
      retries: 2,
      authType: 'bearer',
    });
    console.log(`Found ${models.length} models:`);
    models.forEach((m: any, i: number) => console.log(`  ${i+1}. ${m.id || m.name}`));
  } catch (err: any) {
    console.log('Error:', err.message);
  }
  
  process.exit(0);
})();
