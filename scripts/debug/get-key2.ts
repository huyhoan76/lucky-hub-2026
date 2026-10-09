import { getMongoUri } from '../mongoUri.ts';
import mongoose from 'mongoose';
import { AIProvider } from '../../server/models/AIProvider.ts';
import { decrypt } from '../../server/utils/encryption.ts';

const encKey = process.env.AI_ENCRYPTION_KEY || '';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect(getMongoUri(), { serverSelectionTimeoutMS: 10000 });
  
  const provider = await AIProvider.findOne({ providerId: 'selfhosted', name: '9router' }).lean();
  if (!provider) {
    console.log('Provider not found');
    process.exit(1);
  }
  
  console.log('Provider:', provider.name);
  console.log('Base URL:', provider.baseUrl);
  
  for (const key of provider.apiKeys) {
    try {
      const decrypted = decrypt(key.key);
      console.log(`Key ${key.label}: '${decrypted}'`);
    } catch (err) {
      console.log(`Key ${key.label}: ERROR - ${err.message}`);
    }
  }
  
  process.exit(0);
})();
