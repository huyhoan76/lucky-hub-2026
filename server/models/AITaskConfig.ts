/**
 * AITaskConfig Model
 * Maps AI tasks to provider/model priority with two-level strategy
 */

import mongoose from 'mongoose';

const ProviderPrioritySchema = new mongoose.Schema({
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'AIProvider', required: true },
  enabled: { type: Boolean, default: true },
  // Strategy within this provider: how to select among its models/keys
  strategy: {
    type: String,
    enum: ['round-robin', 'fallback', 'priority'],
    default: 'fallback'
  },
  weight: { type: Number, default: 1, min: 1 }, // For provider-level round-robin
}, { _id: false });

const ModelPrioritySchema = new mongoose.Schema({
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'AIProvider', required: true },
  modelId: { type: String, required: true }, // Model ID (e.g., "gemini-1.5-flash")
  enabled: { type: Boolean, default: true },
  apiKeyIndex: { type: Number, default: -1 }, // -1 = use provider strategy, >=0 = specific key index
  weight: { type: Number, default: 1, min: 1 }, // For model-level round-robin
}, { _id: false });

const AITaskConfigSchema = new mongoose.Schema({
  taskType: {
    type: String,
    required: true,
    unique: true,
    enum: ['chat', 'coach', 'vision', 'verify', 'food', 'meal-plan', 'embedding']
  },

  // Level 1: Provider priority order (admin drag-drop)
  providerPriority: { type: [ProviderPrioritySchema], default: [] },

  // Level 2: Model priority within each provider (admin drag-drop)
  modelPriority: { type: [ModelPrioritySchema], default: [] },

  // Global fallback: if all providers/models fail, try other enabled providers not in list
  globalFallbackEnabled: { type: Boolean, default: true },

  // Default strategy for providers not explicitly configured
  defaultProviderStrategy: {
    type: String,
    enum: ['round-robin', 'fallback', 'priority'],
    default: 'fallback'
  },

  // Metadata
  updatedBy: { type: String, default: 'system' },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Indexes
AITaskConfigSchema.index({ taskType: 1 }, { unique: true });
AITaskConfigSchema.index({ updatedAt: -1 });

// Virtual for enabled providers count
AITaskConfigSchema.virtual('enabledProvidersCount').get(function() {
  return this.providerPriority?.filter((p: any) => p.enabled).length || 0;
});

// Virtual for enabled models count
AITaskConfigSchema.virtual('enabledModelsCount').get(function() {
  return this.modelPriority?.filter((m: any) => m.enabled).length || 0;
});

// Static method to get task config with populated providers
AITaskConfigSchema.statics.getForTask = async function(taskType: string) {
  return this.findOne({ taskType }).lean();
};

// Method to add provider to priority list
AITaskConfigSchema.methods.addProvider = async function(providerId: string, strategy = 'fallback', weight = 1) {
  const exists = this.providerPriority.some((p: any) => p.providerId.toString() === providerId);
  if (!exists) {
    this.providerPriority.push({ providerId, enabled: true, strategy, weight });
    await this.save();
  }
  return this;
};

// Method to remove provider from priority list
AITaskConfigSchema.methods.removeProvider = async function(providerId: string) {
  this.providerPriority = this.providerPriority.filter((p: any) => p.providerId.toString() !== providerId);
  // Also remove associated models
  this.modelPriority = this.modelPriority.filter((m: any) => m.providerId.toString() !== providerId);
  await this.save();
  return this;
};

// Method to reorder provider priority
AITaskConfigSchema.methods.reorderProviders = async function(providerIds: string[]) {
  const reordered = providerIds.map((id, index) => {
    const existing = this.providerPriority.find((p: any) => p.providerId.toString() === id);
    return existing || { providerId: id, enabled: true, strategy: 'fallback', weight: 1 };
  });
  this.providerPriority = reordered;
  await this.save();
  return this;
};

// Method to update provider strategy
AITaskConfigSchema.methods.updateProviderStrategy = async function(providerId: string, strategy: string, weight?: number) {
  const provider = this.providerPriority.find((p: any) => p.providerId.toString() === providerId);
  if (provider) {
    provider.strategy = strategy;
    if (weight !== undefined) provider.weight = weight;
    await this.save();
  }
  return this;
};

// Method to add model to priority list
AITaskConfigSchema.methods.addModel = async function(providerId: string, modelId: string, apiKeyIndex = -1, weight = 1) {
  const exists = this.modelPriority.some((m: any) => m.providerId.toString() === providerId && m.modelId === modelId);
  if (!exists) {
    this.modelPriority.push({ providerId, modelId, enabled: true, apiKeyIndex, weight });
    await this.save();
  }
  return this;
};

// Method to remove model from priority list
AITaskConfigSchema.methods.removeModel = async function(providerId: string, modelId: string) {
  this.modelPriority = this.modelPriority.filter((m: any) => !(m.providerId.toString() === providerId && m.modelId === modelId));
  await this.save();
  return this;
};

// Method to reorder model priority (within a provider)
AITaskConfigSchema.methods.reorderModels = async function(providerId: string, modelIds: string[]) {
  const providerModels = this.modelPriority.filter((m: any) => m.providerId.toString() === providerId);
  const otherModels = this.modelPriority.filter((m: any) => m.providerId.toString() !== providerId);

  const reordered = modelIds.map((id, index) => {
    const existing = providerModels.find((m: any) => m.modelId === id);
    return existing || { providerId, modelId: id, enabled: true, apiKeyIndex: -1, weight: 1 };
  });

  this.modelPriority = [...reordered, ...otherModels];
  await this.save();
  return this;
};

// Method to update model config
AITaskConfigSchema.methods.updateModel = async function(providerId: string, modelId: string, updates: { enabled?: boolean; apiKeyIndex?: number; weight?: number }) {
  const model = this.modelPriority.find((m: any) => m.providerId.toString() === providerId && m.modelId === modelId);
  if (model) {
    Object.assign(model, updates);
    await this.save();
  }
  return this;
};

export const AITaskConfig = mongoose.model('AITaskConfig', AITaskConfigSchema);

export interface ProviderPriorityDoc {
  providerId: mongoose.Types.ObjectId;
  enabled: boolean;
  strategy: 'round-robin' | 'fallback' | 'priority';
  weight: number;
}

export interface ModelPriorityDoc {
  providerId: mongoose.Types.ObjectId;
  modelId: string;
  enabled: boolean;
  apiKeyIndex: number;
  weight: number;
}

export interface AITaskConfigDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  taskType: 'chat' | 'coach' | 'vision' | 'verify' | 'food' | 'meal-plan' | 'embedding';
  providerPriority: ProviderPriorityDoc[];
  modelPriority: ModelPriorityDoc[];
  globalFallbackEnabled: boolean;
  defaultProviderStrategy: 'round-robin' | 'fallback' | 'priority';
  updatedBy: string;
  updatedAt: Date;
  createdAt: Date;

  addProvider(providerId: string, strategy?: string, weight?: number): Promise<AITaskConfigDoc>;
  removeProvider(providerId: string): Promise<AITaskConfigDoc>;
  reorderProviders(providerIds: string[]): Promise<AITaskConfigDoc>;
  updateProviderStrategy(providerId: string, strategy: string, weight?: number): Promise<AITaskConfigDoc>;
  addModel(providerId: string, modelId: string, apiKeyIndex?: number, weight?: number): Promise<AITaskConfigDoc>;
  removeModel(providerId: string, modelId: string): Promise<AITaskConfigDoc>;
  reorderModels(providerId: string, modelIds: string[]): Promise<AITaskConfigDoc>;
  updateModel(providerId: string, modelId: string, updates: { enabled?: boolean; apiKeyIndex?: number; weight?: number }): Promise<AITaskConfigDoc>;
}