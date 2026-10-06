import { Router, Request, Response } from 'express';
import { AuditLog } from '../models/AuditLog.ts';
import { SystemSettings } from '../models/SystemSettings.ts';
import { authMiddleware } from '../middleware/authMiddleware.ts';
import { requirePermission } from '../middleware/requirePermission.ts';
import { RESOURCES } from '../config/permissions.ts';
import { validateBody } from '../../services/validationService.ts';
import { emailService } from '../../services/emailService.ts';
import { uploadToImgBB } from '../utils/imageUtils.ts';
// Using dynamic import for encryption to avoid tsx resolution issues
const getEncryption = async () => {
  const { encrypt, decrypt } = await import('../utils/encryption.ts');
  return { encrypt, decrypt };
};

const router = Router();
router.use(authMiddleware);
router.use(requirePermission(RESOURCES.ADMIN.PANEL));

// ============================================================================
// SYSTEM SETTINGS CRUD
// ============================================================================

// GET /api/admin/system-settings - Get all settings
router.get('/system-settings', async (req: Request, res: Response) => {
  try {
    let settings = await SystemSettings.findOne({}).lean();

    if (!settings) {
      return res.json({
        email: { providers: [], senderEmail: '', senderName: '', appBaseUrl: '' },
        storage: { providers: [] },
        ai: { encryptionKey: '', geminiProxyUrl: '' },
      });
    }

    const maskedSettings = {
      email: {
        ...settings.email,
        providers: settings.email.providers.map((p: any) => ({
          ...p,
          apiKey: p.apiKey ? `${p.apiKey.substring(0, 6)}••••${p.apiKey.substring(p.apiKey.length - 4)}` : '',
        })),
      },
      storage: {
        ...settings.storage,
        providers: settings.storage.providers.map((p: any) => {
          const masked = { ...p };
          if (p.config?.apiKey) {
            masked.config = { ...p.config, apiKey: `${p.config.apiKey.substring(0, 6)}••••${p.config.apiKey.substring(p.config.apiKey.length - 4)}` };
          }
          return masked;
        }),
      },
      ai: {
        ...settings.ai,
        encryptionKey: settings.ai.encryptionKey ? '••••••••••••••••••••••••••••••••••••' : '',
      },
    };

    res.json(maskedSettings);
  } catch (err: any) {
    console.error('[Admin] Get system settings failed:', err);
    res.status(500).json({ message: err.message || 'Lấy cài đặt thất bại' });
  }
});

// POST /api/admin/system-settings - Create or update settings
router.post('/system-settings', async (req: Request, res: Response) => {
  try {
    const { email, storage, ai } = req.body;
    const user = (req as any).user?.fullName || 'admin';

    let settings: any = await SystemSettings.findOne({});

    const updateData: any = { updatedBy: user, updatedAt: new Date() };

    if (email) {
      const { encrypt } = await getEncryption();
      const providers = (email.providers || []).map((p: any) => ({
        ...p,
        apiKey: p.apiKey && !p.apiKey.includes('••••') ? encrypt(p.apiKey) : p.apiKey,
      }));
      updateData.email = { ...email, providers };
    }

    if (storage) {
      const { encrypt } = await getEncryption();
      const providers = (storage.providers || []).map((p: any) => {
        const config = { ...p.config };
        if (config?.apiKey && !config.apiKey.includes('••••')) {
          config.apiKey = encrypt(config.apiKey);
        }
        return { ...p, config };
      });
      updateData.storage = { ...storage, providers };
    }

    if (ai) {
      const { encrypt } = await getEncryption();
      updateData.ai = { ...ai };
      if (ai.encryptionKey && !ai.encryptionKey.includes('••••')) {
        updateData.ai.encryptionKey = encrypt(ai.encryptionKey);
      }
    }

    if (settings) {
      settings = await SystemSettings.findOneAndUpdate({}, updateData, { new: true }).lean();
    } else {
      settings = await SystemSettings.create({ ...updateData, createdBy: user });
    }

    const masked = {
      email: {
        ...settings.email,
        providers: settings.email.providers.map((p: any) => ({
          ...p,
          apiKey: p.apiKey ? `${p.apiKey.substring(0, 6)}••••${p.apiKey.substring(p.apiKey.length - 4)}` : '',
        })),
      },
      storage: {
        ...settings.storage,
        providers: settings.storage.providers.map((p: any) => {
          const masked = { ...p };
          if (p.config?.apiKey) {
            masked.config = { ...p.config, apiKey: `${p.config.apiKey.substring(0, 6)}••••${p.config.apiKey.substring(p.config.apiKey.length - 4)}` };
          }
          return masked;
        }),
      },
      ai: {
        ...settings.ai,
        encryptionKey: settings.ai.encryptionKey ? '••••••••••••••••••••••••••••••••••••' : '',
      },
    };

    res.json({ success: true, settings: masked, message: 'Đã lưu cài đặt!' });
  } catch (err: any) {
    console.error('[Admin] Save system settings failed:', err);
    res.status(500).json({ message: err.message || 'Lưu cài đặt thất bại' });
  }
});

// DELETE /api/admin/system-settings/:section/:providerId - Delete provider
router.delete('/system-settings/:section/:providerId', async (req: Request, res: Response) => {
  try {
    const { section, providerId } = req.params;
    const user = (req as any).user?.fullName || 'admin';

    if (!['email', 'storage'].includes(section)) {
      return res.status(400).json({ message: 'Section không hợp lệ' });
    }

    const settings = await SystemSettings.findOne({});
    if (!settings) {
      return res.status(404).json({ message: 'Chưa có cài đặt' });
    }

    settings[section].providers = settings[section].providers.filter((p: any) => p._id.toString() !== providerId);
    settings.updatedBy = user;
    settings.updatedAt = new Date();
    await settings.save();

    res.json({ success: true, message: 'Đã xóa provider!' });
  } catch (err: any) {
    console.error('[Admin] Delete provider failed:', err);
    res.status(500).json({ message: err.message || 'Xóa thất bại' });
  }
});

// ============================================================================
// TEST ENDPOINTS
// ============================================================================

// POST /api/admin/test-email - Send test email with custom content
router.post('/test-email', requirePermission(RESOURCES.AI.MANAGE), async (req: Request, res: Response) => {
  try {
    const { to, subject, html, providerId } = req.body;

    if (!to) {
      return res.status(400).json({ message: 'Email người nhận là bắt buộc' });
    }

    const settings = await SystemSettings.findOne({});
    let provider;

    if (providerId && settings?.email?.providers) {
      provider = settings.email.providers.find((p: any) => p._id.toString() === providerId);
    }

    if (!provider && settings?.email?.providers?.length > 0) {
      provider = settings.email.providers.find((p: any) => p.isActive);
    }

    if (!provider) {
      return res.status(400).json({ message: 'Không có provider email nào active' });
    }

    const { decrypt } = await getEncryption();
    const apiKey = decrypt(provider.apiKey);

    const emailData = {
      to,
      subject: subject || 'Test Email - Lucky Hub',
      html: html || '<p>Đây là email test từ Lucky Hub Admin Panel</p>',
      provider: provider.provider,
      apiKey,
    };

    await emailService.sendEmail(emailData);

    res.json({ success: true, message: `Đã gửi email test qua ${provider.provider}!` });
  } catch (err: any) {
    console.error('[Admin] Test email failed:', err);
    res.status(500).json({ success: false, message: err.message || 'Gửi email thất bại' });
  }
});

// POST /api/admin/test-email/custom - Send custom test email
router.post('/test-email/custom', requirePermission(RESOURCES.AI.MANAGE), async (req: Request, res: Response) => {
  try {
    const { to, subject, html, providerId } = req.body;

    if (!to) {
      return res.status(400).json({ message: 'Email người nhận là bắt buộc' });
    }

    const settings = await SystemSettings.findOne({});
    let provider;

    if (providerId && settings?.email?.providers) {
      provider = settings.email.providers.find((p: any) => p._id.toString() === providerId);
    }

    if (!provider && settings?.email?.providers?.length > 0) {
      provider = settings.email.providers.find((p: any) => p.isActive);
    }

    if (!provider) {
      return res.status(400).json({ message: 'Không có provider email nào active' });
    }

    const { decrypt } = await getEncryption();
    const apiKey = decrypt(provider.apiKey);

    const emailData = {
      to,
      subject: subject || 'Test Email Tùy Chỉnh - Lucky Hub',
      html: html || '<p>Đây là email test tùy chỉnh từ Lucky Hub Admin Panel</p>',
      provider: provider.provider,
      apiKey,
    };

    await emailService.sendEmail(emailData);

    res.json({ success: true, message: `Đã gửi email tùy chỉnh qua ${provider.provider}!` });
  } catch (err: any) {
    console.error('[Admin] Custom test email failed:', err);
    res.status(500).json({ success: false, message: err.message || 'Gửi email thất bại' });
  }
});

// POST /api/admin/test-storage - Test image storage with specific provider
router.post('/test-storage', requirePermission(RESOURCES.AI.MANAGE), async (req: Request, res: Response) => {
  try {
    const { providerId } = req.body;

    const settings = await SystemSettings.findOne({});
    if (!settings?.storage?.providers?.length) {
      return res.status(400).json({ message: 'Chưa cấu hình storage provider' });
    }

    let provider;
    if (providerId) {
      provider = settings.storage.providers.find((p: any) => p._id.toString() === providerId);
    } else {
      provider = settings.storage.providers.find((p: any) => p.isActive);
    }

    if (!provider) {
      return res.status(400).json({ message: 'Không tìm thấy provider storage' });
    }

    const { decrypt } = await getEncryption();
    const apiKey = decrypt(provider.config?.apiKey);

    const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const originalKey = process.env.IMGBB_API_KEY;
    process.env.IMGBB_API_KEY = apiKey;

    try {
      const result = await uploadToImgBB(testImageBase64);
      process.env.IMGBB_API_KEY = originalKey;

      if (result?.url) {
        res.json({ success: true, message: `Test upload thành công qua ${provider.provider}`, url: result.url });
      } else {
        res.status(500).json({ success: false, message: 'Upload thất bại' });
      }
    } catch (err) {
      process.env.IMGBB_API_KEY = originalKey;
      throw err;
    }
  } catch (err: any) {
    console.error('[Admin] Test storage failed:', err);
    res.status(500).json({ success: false, message: err.message || 'Test storage thất bại' });
  }
});

// NOTE: the previous "legacy" block duplicated POST /test-email and POST /test-storage
// on the same paths. Express only ever ran the first handler registered above, so the
// duplicates were unreachable dead code and have been removed. Both endpoints still exist.

export default router;