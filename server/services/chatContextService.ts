import { User } from '../models/User.ts';
import { Metric } from '../models/Metric.ts';
import { Goal } from '../models/Goal.ts';
import { Knowledge } from '../models/Knowledge.ts';
import { Rule } from '../models/Rule.ts';

const MODULE = 'ChatContextService';

const logger = {
  info: (message: string, data?: any) => {
    console.log(`[${MODULE}] ${message}`, data ? JSON.stringify(data) : '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[${MODULE}] ⚠️ ${message}`, data ? JSON.stringify(data) : '');
  },
  error: (message: string, error?: any) => {
    console.error(`[${MODULE}] ❌ ${message}`, error?.message || error || '');
  }
};

export interface UserChatContext {
  hasMetrics: boolean;
  latestMetrics: {
    weight: number;
    bodyFat: number;
    muscleMass: number;
    waterPercent: number;
    boneMinerals: number;
    visceralFat: number;
    energy: number;
    bioAge: number;
    balanceIndex: number;
    date: string;
  } | null;
  goals: Array<{
    type: string;
    targetValue: number;
    startValue: number;
    status: string;
    progress: number;
  }>;
  dailyCalorieTarget: number;
  macrosTarget: {
    protein: number;
    carbs: number;
    fat: number;
  };
  bmi: number | null;
  userInfo: {
    height: number;
    weight: number;
    gender: string;
    age: number;
    healthGoals: string[];
    fullName: string;
  };
}

/**
 * Tính tuổi từ birthDate string (YYYY-MM-DD)
 */
function calculateAge(birthDate: string): number {
  if (!birthDate) return 0;
  try {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  } catch {
    return 0;
  }
}

/**
 * Tính BMR (Basal Metabolic Rate) - Công thức Mifflin-St Jeor
 */
function calculateBMR(weight: number, height: number, age: number, gender: string): number {
  if (!weight || !height || !age) return 0;
  const bmr = 10 * weight + 6.25 * height - 5 * age;
  return gender === 'Nữ' ? bmr - 161 : bmr + 5;
}

/**
 * Tính TDEE (Total Daily Energy Expenditure)
 */
function calculateTDEE(bmr: number, activityLevel: number = 1.2): number {
  return Math.round(bmr * activityLevel);
}

/**
 * Tính calorie target dựa trên mục tiêu
 */
function calculateCalorieTarget(tdee: number, goals: string[]): number {
  if (!tdee || tdee <= 0) return 0;

  const goalLower = goals.map(g => g.toLowerCase());

  if (goalLower.some(g => g.includes('giảm cân') || g.includes('giảm'))) {
    return Math.max(tdee - 500, 1200);
  }

  if (goalLower.some(g => g.includes('tăng cân') || g.includes('tăng'))) {
    return tdee + 300;
  }

  if (goalLower.some(g => g.includes('thay đổi cấu trúc') || g.includes('body recom'))) {
    return tdee;
  }

  return tdee;
}

/**
 * Tính macros target
 */
function calculateMacrosTarget(calorieTarget: number, goals: string[]): { protein: number; carbs: number; fat: number } {
  if (!calorieTarget || calorieTarget <= 0) {
    return { protein: 0, carbs: 0, fat: 0 };
  }

  const goalLower = goals.map(g => g.toLowerCase());

  let proteinRatio = 0.25;
  let carbsRatio = 0.50;
  let fatRatio = 0.25;

  if (goalLower.some(g => g.includes('giảm cân') || g.includes('giảm'))) {
    proteinRatio = 0.30;
    carbsRatio = 0.40;
    fatRatio = 0.30;
  }

  if (goalLower.some(g => g.includes('tăng cân') || g.includes('tăng cơ') || g.includes('body recom'))) {
    proteinRatio = 0.35;
    carbsRatio = 0.40;
    fatRatio = 0.25;
  }

  if (goalLower.some(g => g.includes('tiểu đường') || g.includes('diabetes'))) {
    proteinRatio = 0.25;
    carbsRatio = 0.35;
    fatRatio = 0.40;
  }

  return {
    protein: Math.round((calorieTarget * proteinRatio) / 4),
    carbs: Math.round((calorieTarget * carbsRatio) / 4),
    fat: Math.round((calorieTarget * fatRatio) / 9),
  };
}

/**
 * Lấy context đầy đủ của user cho AI chat
 */
export async function getUserChatContext(userId: string): Promise<UserChatContext> {
  const startTime = Date.now();
  logger.info(`🔍 Fetching chat context for user ${userId}`);

  try {
    const [user, metrics, goals] = await Promise.all([
      User.findById(userId).lean(),
      Metric.find({ userId }).sort({ date: -1 }).limit(1).lean(),
      Goal.find({ userId, status: 'active' }).lean(),
    ]);

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const latestMetric = metrics[0] || null;
    const activeGoals = goals || [];

    // Tính toán các chỉ số
    const age = calculateAge(user.birthDate || '');
    const weight = latestMetric?.weight || user.weight || 0;
    const height = user.height || 0;
    const bmr = calculateBMR(weight, height, age, user.gender || 'Nam');
    const tdee = calculateTDEE(bmr);
    const healthGoals = user.healthGoals || [];
    const dailyCalorieTarget = calculateCalorieTarget(tdee, healthGoals);
    const macrosTarget = calculateMacrosTarget(dailyCalorieTarget, healthGoals);
    const bmi = height > 0 ? Math.round((weight / Math.pow(height / 100, 2)) * 10) / 10 : null;

    const context: UserChatContext = {
      hasMetrics: !!latestMetric,
      latestMetrics: latestMetric ? {
        weight: latestMetric.weight,
        bodyFat: latestMetric.bodyFat,
        muscleMass: latestMetric.muscleMass,
        waterPercent: latestMetric.waterPercent,
        boneMinerals: latestMetric.boneMinerals,
        visceralFat: latestMetric.visceralFat,
        energy: latestMetric.energy,
        bioAge: latestMetric.bioAge,
        balanceIndex: latestMetric.balanceIndex,
        date: latestMetric.date,
      } : null,
      goals: activeGoals.map(g => ({
        type: g.type,
        targetValue: g.targetValue,
        startValue: g.startValue,
        status: g.status,
        progress: g.progress || 0,
      })),
      dailyCalorieTarget,
      macrosTarget,
      bmi,
      userInfo: {
        height,
        weight,
        gender: user.gender || 'Nam',
        age,
        healthGoals,
        fullName: user.fullName || 'Người dùng',
      },
    };

    logger.info(`✅ Chat context built: hasMetrics=${context.hasMetrics}, calorieTarget=${dailyCalorieTarget}, goals=${activeGoals.length}, bmi=${bmi}`);
    return context;
  } catch (error: any) {
    logger.error(`Failed to get chat context for user ${userId}`, error);
    // Trả về context mặc định
    return {
      hasMetrics: false,
      latestMetrics: null,
      goals: [],
      dailyCalorieTarget: 0,
      macrosTarget: { protein: 0, carbs: 0, fat: 0 },
      bmi: null,
      userInfo: {
        height: 0,
        weight: 0,
        gender: 'Nam',
        age: 0,
        healthGoals: [],
        fullName: 'Người dùng',
      },
    };
  }
}

/**
 * Tìm kiếm knowledge liên quan đến query
 */
export async function searchRelevantKnowledge(
  query: string,
  healthGoals: string[] = [],
  options?: {
    category?: string;
    limit?: number;
  }
): Promise<Array<{ keyword: string; content: string; category: string; tags: string[] }>> {
  const limit = options?.limit || 8;
  const startTime = Date.now();

  try {
    if (!query || query.trim().length < 2) {
      return [];
    }

    // Extract keywords from query
    const words = query.toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 2)
      .slice(0, 5);

    const allKeywords = [...words, ...healthGoals.map(g => g.toLowerCase())];
    const escapedKeywords = allKeywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const searchPattern = escapedKeywords.join('|');

    const queryObj: any = {
      $or: [
        { keyword: { $regex: searchPattern, $options: 'i' } },
        { tags: { $in: allKeywords.map(k => new RegExp(k, 'i')) } },
        { content: { $regex: searchPattern, $options: 'i' } },
        { relatedKeywords: { $in: allKeywords.map(k => new RegExp(k, 'i')) } }
      ]
    };

    if (options?.category) {
      queryObj.category = options.category;
    }

    const results = await Knowledge.find(queryObj)
      .select('keyword content category tags')
      .limit(limit)
      .lean()
      .exec();

    const duration = Date.now() - startTime;
    logger.info(`searchRelevantKnowledge: found ${results.length} entries for query "${query}" in ${duration}ms`);

    return results.map(r => ({
      keyword: r.keyword,
      content: r.content,
      category: r.category,
      tags: r.tags || []
    }));
  } catch (error: any) {
    logger.error(`searchRelevantKnowledge error`, error);
    return [];
  }
}

/**
 * Lấy knowledge theo category cho base knowledge
 */
export async function getBaseKnowledge(
  category: string,
  limit: number = 5
): Promise<Array<{ keyword: string; content: string; category: string; tags: string[] }>> {
  try {
    const results = await Knowledge.find({ category })
      .select('keyword content category tags')
      .limit(limit)
      .lean()
      .exec();

    return results.map(r => ({
      keyword: r.keyword,
      content: r.content,
      category: r.category,
      tags: r.tags || []
    }));
  } catch (error: any) {
    logger.error(`getBaseKnowledge error for category "${category}"`, error);
    return [];
  }
}

/**
 * Build system prompt context string cho AI
 */
export async function buildChatSystemContext(
  userId: string,
  userMessage: string
): Promise<{
  systemPrompt: string;
  userContext: UserChatContext;
  relevantKnowledge: Array<{ keyword: string; content: string; category: string }>;
  rules: Array<{ content: string }>;
}> {
  const startTime = Date.now();

  try {
    // 1. Fetch user context first (needed for healthGoals)
    const userContext = await getUserChatContext(userId);

    // 2. Then fetch knowledge & rules in parallel using userContext - with individual error handling
    let relevantKnowledge: any[] = [];
    let baseNutritionKnowledge: any[] = [];
    let rules: any[] = [];

    try {
      relevantKnowledge = await searchRelevantKnowledge(userMessage, (userContext.goals || []).map(g => g.type));
    } catch (e) {
      logger.error('searchRelevantKnowledge failed', e);
      relevantKnowledge = [];
    }

    try {
      baseNutritionKnowledge = await getBaseKnowledge('nutrition', 3);
    } catch (e) {
      logger.error('getBaseKnowledge failed', e);
      baseNutritionKnowledge = [];
    }

    try {
      rules = await Rule.find().lean().exec();
    } catch (e) {
      logger.error('Rule.find failed', e);
      rules = [];
    }

    // Build knowledge context - defensive checks
    const knowledgeParts: string[] = [];

    if (Array.isArray(relevantKnowledge) && relevantKnowledge.length > 0) {
      knowledgeParts.push('=== KIẾN THỨC LIÊN QUAN (từ Knowledge Base) ===');
      relevantKnowledge.forEach((entry, i) => {
        knowledgeParts.push(`[${i + 1}] ${entry.keyword}: ${entry.content}`);
      });
    }

    if (Array.isArray(baseNutritionKnowledge) && baseNutritionKnowledge.length > 0) {
      knowledgeParts.push('\n=== KIẾN THỨC DINH DƯỠNG CƠ BẢN ===');
      baseNutritionKnowledge.forEach((entry, i) => {
        knowledgeParts.push(`[${i + 1}] ${entry.keyword}: ${entry.content}`);
      });
    }

    const knowledgeContext = knowledgeParts.length > 0
      ? knowledgeParts.join('\n\n')
      : 'Không có kiến thức chuyên môn liên quan trong hệ thống.';

    // Build user context string - with error handling
    let userContextStr: string;
    try {
      userContextStr = buildUserContextString(userContext);
    } catch (e) {
      logger.error('buildUserContextString failed', e);
      userContextStr = `Họ tên: ${userContext.userInfo.fullName}\nTuổi: ${userContext.userInfo.age} | Giới tính: ${userContext.userInfo.gender} | Chiều cao: ${userContext.userInfo.height}cm\nChỉ số: CHƯA CÓ DỮ LIỆU`;
    }

    // Build rules string - defensive check
    const rulesStr = Array.isArray(rules) && rules.length > 0
      ? rules.map((r, i) => `${i + 1}. ${r.content}`).join('\n')
      : 'Không có quy tắc đặc biệt.';

    // Build complete system prompt
    const systemPrompt = `Bạn là "🍀Trợ lý Lucky" - chuyên gia tư vấn sức khỏe, dinh dưỡng và thể hình.

=== THÔNG TIN NGƯỜI DÙNG ===
${userContextStr}

${knowledgeContext}

=== QUY TẮC TUÂN THỦ ===
${rulesStr}

=== HƯỚNG DẪN PHẢN HỒI ===
1. Luôn xưng hô: "Trợ lý Lucky" gọi user là "bạn" hoặc tên.
2. Trả lời Tiếng Việt, tự nhiên, chuyên nghiệp, thân thiện.
3. Dựa trên CHỈ SỐ THỰC TẾ (nếu có) để tư vấn cá nhân hóa.
4. Nếu user hỏi về dinh dưỡng/calo: ưu tiên dùng dailyCalorieTarget & macrosTarget.
5. Nếu user hỏi về bài tập/chuyển hóa: tham khảo BMI, BMR, TDEE.
6. Không bịa đặt số liệu. Nếu thiếu dữ liệu → nói rõ "chưa có dữ liệu..." và khuyên đo InBody.
7. Khuyến khích theo dõi chỉ số định kỳ.`;

    const duration = Date.now() - startTime;
    logger.info(`✅ System context built in ${duration}ms (knowledge: ${relevantKnowledge.length + baseNutritionKnowledge.length}, rules: ${rules.length})`);

    return {
      systemPrompt,
      userContext,
      relevantKnowledge,
      rules: rules.map(r => ({ content: r.content })),
    };
  } catch (error: any) {
    logger.error(`buildChatSystemContext error`, error);
    // Fallback minimal context
    return {
      systemPrompt: `Bạn là "🍀Trợ lý Lucky". Hãy trả lời ngắn gọn, chuyên nghiệp, bằng Tiếng Việt.`,
      userContext: await getUserChatContext(userId),
      relevantKnowledge: [],
      rules: [],
    };
  }
}

/**
 * Build user context string từ UserChatContext
 */
function buildUserContextString(ctx: UserChatContext): string {
  const parts: string[] = [];

  parts.push(`Họ tên: ${ctx.userInfo.fullName}`);
  parts.push(`Tuổi: ${ctx.userInfo.age} | Giới tính: ${ctx.userInfo.gender} | Chiều cao: ${ctx.userInfo.height}cm`);

  if (ctx.hasMetrics && ctx.latestMetrics) {
    const m = ctx.latestMetrics;
    parts.push(`Chỉ số mới nhất (${m.date}):`);
    parts.push(`  - Cân nặng: ${m.weight}kg | Mỡ cơ thể: ${m.bodyFat}% | Lượng cơ: ${m.muscleMass}kg`);
    parts.push(`  - Nước: ${m.waterPercent}% | Khoáng: ${m.boneMinerals}kg | Mỡ nội tạng: ${m.visceralFat}`);
    parts.push(`  - Năng lượng: ${m.energy}kcal | Tuổi sinh học: ${m.bioAge} | Cân đối: ${m.balanceIndex}`);
  } else {
    parts.push('Chỉ số: CHƯA CÓ DỮ LIỆU (chưa đo InBody/cân điện tử)');
  }

  if (ctx.bmi !== null) {
    parts.push(`BMI: ${ctx.bmi}`);
  }

  parts.push(`BMR: ${calculateBMR(ctx.userInfo.weight, ctx.userInfo.height, ctx.userInfo.age, ctx.userInfo.gender)} kcal/ngày`);
  parts.push(`TDEE (sedentary): ${calculateTDEE(calculateBMR(ctx.userInfo.weight, ctx.userInfo.height, ctx.userInfo.age, ctx.userInfo.gender))} kcal/ngày`);

  if (ctx.dailyCalorieTarget > 0) {
    parts.push(`Mục tiêu calo/ngày: ${ctx.dailyCalorieTarget} kcal`);
    parts.push(`Macros: Protein ${ctx.macrosTarget.protein}g | Carbs ${ctx.macrosTarget.carbs}g | Fat ${ctx.macrosTarget.fat}g`);
  }

  if (ctx.userInfo.healthGoals && ctx.userInfo.healthGoals.length > 0) {
    parts.push(`Mục tiêu sức khỏe: ${ctx.userInfo.healthGoals.join(', ')}`);
  }

  if (ctx.goals.length > 0) {
    parts.push(`Mục tiêu đang theo dõi:`);
    ctx.goals.forEach(g => {
      parts.push(`  - ${g.type}: ${g.startValue} → ${g.targetValue} (${g.progress}%)`);
    });
  }

  return parts.join('\n');
}