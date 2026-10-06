import mongoose from 'mongoose';
import { ActiveSession } from './server/models/ActiveSession.ts';
import { User } from './server/models/User.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect('mongodb+srv://vnminenetworkgame_db_user:vsKaIcSSJhfiJYLn@luckyhub.myqla9g.mongodb.net/lucky_hub?retryWrites=true&w=majority', { serverSelectionTimeoutMS: 10000 });
  
  console.log('Active sessions:');
  const sessions = await ActiveSession.find({ isActive: true }).lean();
  for (const s of sessions) {
    const user = await User.findById(s.userId).lean();
    console.log(`  Session: ${s.sessionId.substring(0, 20)}... | User: ${user?.fullName || user?.username || s.userId} | Created: ${s.createdAt}`);
  }
  
  process.exit(0);
})();
