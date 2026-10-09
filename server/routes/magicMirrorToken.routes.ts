import { createHash, randomBytes } from 'crypto';
import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { MagicMirrorToken } from '../models/MagicMirrorToken.ts';
import { authMiddleware } from '../middleware/authMiddleware.ts';
import { requirePermission } from '../middleware/requirePermission.ts';
import { RESOURCES } from '../config/permissions.ts';
import { encrypt, decrypt } from '../utils/encryption.ts';

const router = Router();
router.use(authMiddleware, requirePermission(RESOURCES.ADMIN.PANEL));

function parseExpiry(value: unknown): Date | null | undefined {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const expiry = new Date(`${value}T23:59:59.999Z`);
  if (Number.isNaN(expiry.getTime()) || expiry.toISOString().slice(0, 10) !== value) return undefined;
  return expiry;
}

function serializeToken(token: any) {
  return {
    id: token._id.toString(),
    name: token.name,
    tokenPrefix: token.tokenPrefix,
    isActive: token.isActive,
    createdAt: token.createdAt,
    expiresAt: token.expiresAt,
  };
}

function hasValidTokenId(id: string, res: Response): boolean {
  if (mongoose.Types.ObjectId.isValid(id)) return true;
  res.status(400).json({ message: 'ID token không hợp lệ.' });
  return false;
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const tokens = await MagicMirrorToken.find({})
      .select('name tokenPrefix isActive createdAt expiresAt')
      .sort({ createdAt: -1 })
      .lean();
    res.json(tokens.map(serializeToken));
  } catch (error) {
    console.error('[MagicMirrorTokens] List failed:', error);
    res.status(500).json({ message: 'Không thể tải danh sách token Magic Mirror.' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 80) {
      return res.status(400).json({ message: 'Tên token bắt buộc và tối đa 80 ký tự.' });
    }

    const expiresAt = parseExpiry(req.body.expiresAt);
    if (expiresAt === undefined) {
      return res.status(400).json({ message: 'Ngày hết hạn không hợp lệ.' });
    }

    const tokenValue = randomBytes(32).toString('base64url');
    const token = await MagicMirrorToken.create({
      name,
      encryptedToken: encrypt(tokenValue),
      tokenHash: createHash('sha256').update(tokenValue).digest('hex'),
      tokenPrefix: tokenValue.slice(0, 8),
      isActive: true,
      expiresAt,
      createdBy: req.user?.userId || 'admin',
    });

    console.log(`[MagicMirrorTokens] Created token ${token._id} by ${req.user?.userId}`);
    res.set('Cache-Control', 'no-store');
    res.status(201).json({ token: serializeToken(token), secret: tokenValue });
  } catch (error) {
    console.error('[MagicMirrorTokens] Create failed:', error);
    res.status(500).json({ message: 'Không thể tạo token Magic Mirror.' });
  }
});

router.post('/:id/reveal', async (req: Request, res: Response) => {
  try {
    if (!hasValidTokenId(req.params.id, res)) return;
    const token = await MagicMirrorToken.findById(req.params.id).select('encryptedToken');
    if (!token) return res.status(404).json({ message: 'Không tìm thấy token.' });

    const secret = decrypt(token.encryptedToken);
    res.set('Cache-Control', 'no-store');
    res.json({ secret });
  } catch (error) {
    console.error('[MagicMirrorTokens] Reveal failed:', error);
    res.status(500).json({ message: 'Không thể giải mã token. Kiểm tra AI_ENCRYPTION_KEY.' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    if (!hasValidTokenId(req.params.id, res)) return;
    const token = await MagicMirrorToken.findById(req.params.id);
    if (!token) return res.status(404).json({ message: 'Không tìm thấy token.' });

    if (req.body.name !== undefined) {
      if (typeof req.body.name !== 'string' || !req.body.name.trim() || req.body.name.trim().length > 80) {
        return res.status(400).json({ message: 'Tên token bắt buộc và tối đa 80 ký tự.' });
      }
      token.name = req.body.name.trim();
    }

    if (req.body.expiresAt !== undefined) {
      const expiresAt = parseExpiry(req.body.expiresAt);
      if (expiresAt === undefined) return res.status(400).json({ message: 'Ngày hết hạn không hợp lệ.' });
      token.expiresAt = expiresAt;
    }

    if (req.body.isActive !== undefined) {
      if (typeof req.body.isActive !== 'boolean') {
        return res.status(400).json({ message: 'Trạng thái token không hợp lệ.' });
      }
      token.isActive = req.body.isActive;
    }

    await token.save();
    console.log(`[MagicMirrorTokens] Updated token ${token._id} by ${req.user?.userId}`);
    res.json({ token: serializeToken(token) });
  } catch (error) {
    console.error('[MagicMirrorTokens] Update failed:', error);
    res.status(500).json({ message: 'Không thể cập nhật token Magic Mirror.' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!hasValidTokenId(req.params.id, res)) return;
    const token = await MagicMirrorToken.findByIdAndDelete(req.params.id);
    if (!token) return res.status(404).json({ message: 'Không tìm thấy token.' });

    console.log(`[MagicMirrorTokens] Deleted token ${token._id} by ${req.user?.userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[MagicMirrorTokens] Delete failed:', error);
    res.status(500).json({ message: 'Không thể xóa token Magic Mirror.' });
  }
});

export default router;
