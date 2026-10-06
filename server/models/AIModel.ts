/**
 * AIModel Model
 * Cached discovered models from provider APIs
 */

import mongoose from 'mongoose';

const CapabilitiesSchema = new mongoose.Schema({
  chat: { type: Boolean, default: true },
  vision: { type: Boolean, default: false },
  functionCalling: { type: Boolean, default: false },
  jsonMode: { type: Boolean, default: true },
  maxContext: { type: Number, default: 4096 },
  maxOutput: { type: Number, default: 2048 },
}, { _id: false });

const PricingSchema = new mongoose.Schema({
  input: { type: Number, default: 0 }, // USD per 1M tokens
  output: { type: Number, default: 0 },
}, { _id: false });

const AIModelSchema = new mongoose.Schema({
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'AIProvider', required: true, index: true },
  providerName: { type: String, required: true }, // Denormalized for easier queries
  modelId: { type: String, required: true }, // e.g., "gemini-1.5-flash", "deepseek/deepseek-chat"
  displayName: { type: String, required: true }, // e.g., "Gemini 1.5 Flash"

  capabilities: { type: CapabilitiesSchema, default: {} },
  pricing: { type: PricingSchema, default: {} },

  isFreeTier: { type: Boolean, default: false, index: true },
  isActive: { type: Boolean, default: true, index: true },

  // Discovery metadata
  discoveredAt: { type: Date, default: Date.now },
  lastChecked: { type: Date, default: Date.now },
  checkCount: { type: Number, default: 1 },
  lastCheckError: { type: String, default: '' },

  // Admin notes
  adminNotes: { type: String, default: '' },
}, { timestamps: true });

// Compound indexes
AIModelSchema.index({ providerId: 1, isActive: 1 });
AIModelSchema.index({ providerId: 1, modelId: 1 }, { unique: true });
AIModelSchema.index({ isFreeTier: 1, isActive: 1 });
AIModelSchema.index({ 'capabilities.vision': 1, isActive: 1 });

// Virtual for display with free tier badge
AIModelSchema.virtual('displayWithBadge').get(function() {
  return this.isFreeTier ? `🆓 ${this.displayName}` : this.displayName;
});

// Static method to find models for a task type
AIModelSchema.statics.findForTask = function(taskType: string, providerIds?: mongoose.Types.ObjectId[]) {
  const query: any = { isActive: true };

  if (providerIds?.length) {
    query.providerId = { $in: providerIds };
  }

  switch (taskType) {
    case 'vision':
    case 'verify':
    case 'food':
      query['capabilities.vision'] = true;
      break;
    case 'chat':
    case 'coach':
    case 'meal-plan':
      query['capabilities.chat'] = true;
      break;
  }

  return this.find(query).sort({ isFreeTier: -1, 'capabilities.maxContext': -1 });
};

// Static method to get model with capabilities
AIModelSchema.statics.getModelWithCaps = function(providerId: string, modelId: string) {
  return this.findOne({ providerId, modelId, isActive: true });
};

export const AIModel = mongoose.model('AIModel', AIModelSchema);

export interface AIModelDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  providerName: string;
  modelId: string;
  displayName: string;
  capabilities: {
    chat: boolean;
    vision: boolean;
    functionCalling: boolean;
    jsonMode: boolean;
    maxContext: number;
    maxOutput: number;
  };
  pricing: {
    input: number;
    output: number;
  };
  isFreeTier: boolean;
  isActive: boolean;
  discoveredAt: Date;
  lastChecked: Date;
  checkCount: number;
  lastCheckError: string;
  adminNotes: string;
  createdAt: Date;
  updatedAt: Date;
}