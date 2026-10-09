import mongoose from 'mongoose';

const MagicMirrorTokenSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  encryptedToken: { type: String, required: true },
  tokenHash: { type: String, required: true, unique: true },
  tokenPrefix: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null },
  createdBy: { type: String, required: true },
}, { timestamps: true });

export const MagicMirrorToken = mongoose.model('MagicMirrorToken', MagicMirrorTokenSchema);
