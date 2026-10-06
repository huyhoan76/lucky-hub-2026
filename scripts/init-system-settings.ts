/**
 * Initialize System Settings from .env
 * Run once: npx tsx scripts/init-system-settings.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('/home/ubuntu/DATA/projects/lucky-hub-2026/.env') });

import { SystemSettings } from '/home/ubuntu/DATA/projects/lucky-hub-2026/server/models/SystemSettings.ts';
import { encrypt } from '/home/ubuntu/DATA/projects/lucky-hub-2026/server/utils/encryption.ts';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lucky_hub';

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
    });
    console.log('✅ Connected to MongoDB');
  } catch (err: any) {
    console.error('❌ DB Connection Error:', err.message);
    process.exit(1);
  }
}

async function initSystemSettings() {
  console.log('\n🚀 ============ INIT SYSTEM SETTINGS ============\n');

  try {
    const existing = await SystemSettings.findOne({});
    if (existing) {
      console.log('⚠️  System settings already exist, skipping initialization');
      console.log('   To re-initialize, delete the existing document first');
      return;
    }

    console.log('📝 Creating system settings from .env...\n');

    // Build email providers from .env
    const emailProviders = [];

    if (process.env.BREVO_API_KEY) {
      emailProviders.push({
        provider: 'brevo',
        apiKey: encrypt(process.env.BREVO_API_KEY),
        isActive: true,
        priority: 1,
        label: 'Brevo (Primary)',
      });
      console.log('   ✅ Added Brevo provider');
    }

    if (process.env.SENDGRID_API_KEY) {
      emailProviders.push({
        provider: 'sendgrid',
        apiKey: encrypt(process.env.SENDGRID_API_KEY),
        isActive: true,
        priority: 2,
        label: 'SendGrid (Fallback)',
      });
      console.log('   ✅ Added SendGrid provider');
    }

    // Build storage providers from .env
    const storageProviders = [];

    if (process.env.IMGBB_API_KEY) {
      storageProviders.push({
        provider: 'imgbb',
        config: { apiKey: encrypt(process.env.IMGBB_API_KEY) },
        isActive: true,
        priority: 1,
        label: 'ImgBB (Primary)',
      });
      console.log('   ✅ Added ImgBB provider');
    }

    // AI settings
    const aiSettings = {
      encryptionKey: process.env.AI_ENCRYPTION_KEY || '',
      geminiProxyUrl: process.env.GEMINI_PROXY_URL || '',
    };

    if (aiSettings.encryptionKey) {
      console.log('   ✅ Added AI Encryption Key');
    }
    if (aiSettings.geminiProxyUrl) {
      console.log('   ✅ Added Gemini Proxy URL');
    }

    // Create system settings document
    const settings = new SystemSettings({
      email: {
        providers: emailProviders,
        senderEmail: process.env.EMAIL_FROM || 'luckyhubvn@gmail.com',
        senderName: process.env.EMAIL_FROM_NAME || 'Lucky Hub',
        appBaseUrl: process.env.FRONTEND_URL || 'https://lucky-hub-2026.onrender.com',
        updatedBy: 'migration',
      },
      storage: {
        providers: storageProviders,
        updatedBy: 'migration',
      },
      ai: {
        ...aiSettings,
        updatedBy: 'migration',
      },
    });

    await settings.save();
    console.log('\n✅ System settings created successfully!');
    console.log(`   Email providers: ${emailProviders.length}`);
    console.log(`   Storage providers: ${storageProviders.length}`);
    console.log(`   AI Encryption Key: ${aiSettings.encryptionKey ? 'Set' : 'Not set'}`);
    console.log(`   Gemini Proxy URL: ${aiSettings.geminiProxyUrl || 'Not set'}`);

  } catch (err: any) {
    console.error('\n❌ Initialization failed:', err);
    throw err;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  connectDB().then(() => initSystemSettings()).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  }).finally(() => {
    mongoose.connection.close();
    process.exit(0);
  });
}