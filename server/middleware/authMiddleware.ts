import { Request, Response, NextFunction } from 'express';
import { ActiveSession } from '../models/ActiveSession.ts';
import { User } from '../models/User.ts';
import { getEffectivePermissions } from '../services/permissionService.ts';
import { clearSessionCookie, getSessionIdFromCookie, isSessionIdleExpired, setSessionCookie } from '../utils/sessionCookie.ts';

// Mở rộng type Request để thêm user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        groupName?: string;
        permissions: string[];
        fullName: string;
        email: string;
        username: string;
      };
    }
  }
}

/**
 * Middleware xác thực session
 * Yêu cầu cookie xác thực HTTP-only
 * Gắn req.user nếu session hợp lệ
 * Cho phép request đi tiếp (các middleware sau có thể từ chối dựa trên permissions)
 * Nếu token không hợp lệ → 401
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = getSessionIdFromCookie(req);

    if (!sessionId) {
      return res.status(401).json({ 
        message: 'Thiếu token xác thực',
        reason: 'no_token'
      });
    }

    if (!sessionId || sessionId.length < 10) {
      return res.status(401).json({ 
        message: 'Token không hợp lệ',
        reason: 'invalid_token'
      });
    }

    // Tìm session
    const session = await ActiveSession.findOne({ 
      sessionId, 
      isActive: true 
    });

    if (!session) {
      clearSessionCookie(req, res);
      return res.status(401).json({ 
        message: 'Phiên đăng nhập không còn hiệu lực. Vui lòng đăng nhập lại.',
        reason: 'session_invalidated'
      });
    }

    const now = new Date();
    if (isSessionIdleExpired(!!session.rememberMe, session.lastPing, now.getTime())) {
      await ActiveSession.updateOne({ _id: session._id }, { $set: { isActive: false } });
      clearSessionCookie(req, res);
      return res.status(401).json({
        message: 'Phiên đăng nhập đã hết hạn do không hoạt động.',
        reason: 'session_expired'
      });
    }

    // Update lastPing định kỳ (chỉ update nếu lastPing cũ hơn 60s) để giảm DB writes
    const lastPingTime = session.lastPing ? new Date(session.lastPing).getTime() : 0;
    if (now.getTime() - lastPingTime > 60000) {
      ActiveSession.updateOne(
        { _id: session._id },
        { $set: { lastPing: now } }
      ).catch((err: any) => {
        console.error(`[Auth] Failed to update lastPing: ${err.message}`);
      });
    }
    setSessionCookie(req, res, sessionId, !!session.rememberMe);

    // Lấy thông tin user
    const user = await User.findById(session.userId).select('groupId groupName fullName email username status');
    
    if (!user) {
      clearSessionCookie(req, res);
      return res.status(401).json({ 
        message: 'Người dùng không tồn tại',
        reason: 'user_not_found'
      });
    }

    if (user.status !== 'ACTIVE') {
      clearSessionCookie(req, res);
      return res.status(403).json({ 
        message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên.',
        reason: 'account_suspended'
      });
    }

    // Lấy permissions từ group (có cache TTL)
    const effectivePermissions = await getEffectivePermissions(
      String(user._id)
    );

    // Gắn user info vào request
    req.user = {
      userId: String(user._id),
      groupName: (user as any).groupName || '',
      permissions: effectivePermissions,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
    };

    // Chỉ log auth trong debug mode (giảm 90% log noise)
    // console.log(`[Auth] ✅ Verified: ${user.fullName} (@${user.username}) - ${effectivePermissions.length} permissions`);
    next();
  } catch (err: any) {
    console.error(`[Auth] ❌ Error: ${err.message}`);
    return res.status(500).json({ 
      message: 'Lỗi xác thực',
      reason: 'internal_error'
    });
  }
}

/**
 * Middleware xác thực tùy chọn - không bắt buộc có token
 * Nếu có token hợp lệ thì gắn req.user, nếu không thì vẫn cho qua
 * Dùng cho các route công cộng nhưng muốn biết user đăng nhập hay không
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = getSessionIdFromCookie(req);
    if (!sessionId || sessionId.length < 10) {
      next();
      return;
    }

    const session = await ActiveSession.findOne({ sessionId, isActive: true });
    if (!session) {
      clearSessionCookie(req, res);
      next();
      return;
    }

    const now = new Date();
    if (isSessionIdleExpired(!!session.rememberMe, session.lastPing, now.getTime())) {
      await ActiveSession.updateOne({ _id: session._id }, { $set: { isActive: false } });
      clearSessionCookie(req, res);
      next();
      return;
    }

    setSessionCookie(req, res, sessionId, !!session.rememberMe);
    const user = await User.findById(session.userId).select('groupId groupName fullName email username status');
    if (user && user.status === 'ACTIVE') {
      const { getEffectivePermissions } = await import('../services/permissionService.ts');
      const effectivePermissions = await getEffectivePermissions(String(user._id));
      req.user = {
        userId: String(user._id),
        groupName: (user as any).groupName || '',
        permissions: effectivePermissions,
        fullName: user.fullName,
        email: user.email,
        username: user.username,
      };
    }
    next();
  } catch {
    next(); // Bỏ qua lỗi, cho request đi tiếp
  }
}