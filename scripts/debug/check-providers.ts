import mongoose from 'mongoose';
import { AIProvider } from './server/models/AIProvider.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect('mongodb+srv://vnminenetworkgame_db_user:vsKaIcSSJhfiJYLn@luckyhub.myqla9g.mongodb.net/lucky_hub?retryWrites=true&w=majority', { serverSelectionTimeoutMS: 10000 });

  const providers = await AIProvider.find({}).lean();
  console.log('Total providers:', providers.length);
  for (const p of providers) {
    console.log(`- ${p._id}: ${p.name} (${p.providerId})`);
  }
  
  process.exit(0);
})();
