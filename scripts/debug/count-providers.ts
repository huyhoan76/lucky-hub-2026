import { getMongoUri } from '../mongoUri.ts';
import mongoose from 'mongoose';
import { AIProvider } from '../../server/models/AIProvider.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect(getMongoUri(), { serverSelectionTimeoutMS: 10000 });
  const providers = await AIProvider.find().lean();
  console.log(`Total providers: ${providers.length}`);
  providers.forEach((p, i) => {
    console.log(`${i+1}. ${p.name} (${p.providerId}) [_id: ${p._id}]`);
  });
  process.exit(0);
})();
