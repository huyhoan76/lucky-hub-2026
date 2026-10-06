import mongoose from 'mongoose';
import { User } from './server/models/User.ts';
import { Group } from './server/models/Group.ts';

(async () => {
  mongoose.set('strictQuery', false);
  await mongoose.connect('mongodb+srv://vnminenetworkgame_db_user:vsKaIcSSJhfiJYLn@luckyhub.myqla9g.mongodb.net/lucky_hub?retryWrites=true&w=majority', { serverSelectionTimeoutMS: 10000 });
  
  const users = await User.find({}).select('username email fullName status groupId').lean();
  console.log('Total users:', users.length);
  for (const u of users) {
    console.log(`User: ${u.username} | ${u.fullName} | status=${u.status} | groupId=${u.groupId}`);
  }
  
  const groups = await Group.find({}).select('name permissions').lean();
  console.log('\nGroups:');
  for (const g of groups) {
    console.log(`  Group: ${g.name} | permissions=${JSON.stringify(g.permissions)}`);
  }
  
  process.exit(0);
})();
