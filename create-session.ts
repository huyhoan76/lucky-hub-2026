import mongoose from 'mongoose';
import { User } from './server/models/User.ts';
import { ActiveSession } from './server/models/ActiveSession.ts';
import crypto from 'crypto';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect('mongodb+srv://vnminenetworkgame_db_user:vsKaIcSSJhfiJYLn@luckyhub.myqla9g.mongodb.net/lucky_hub?retryWrites=true&w=majority', { serverSelectionTimeoutMS: 10000 });
  
  const user = await User.findOne({ username: 'admin' });
  if (!user) {
    console.log('Admin user not found');
    process.exit(1);
  }
  
  console.log(`Found admin user: ${user.fullName} (${user._id})`);
  
  // Create new session
  const sessionId = crypto.randomBytes(32).toString('hex');
  
  // Invalidate old sessions
  await ActiveSession.updateMany({ userId: user._id }, { isActive: false });
  
  const session = await ActiveSession.create({
    userId: user._id,
    sessionId,
    device: 'debug-session',
    ip: '127.0.0.1',
    isActive: true,
    lastPing: new Date()
  });
  
  console.log(`Created session: ${sessionId}`);
  console.log(`\nUse this token to call APIs:`);
  console.log(`curl -H "Authorization: Bearer ${sessionId}" http://localhost:7860/api/...`);
  
  process.exit(0);
})();
