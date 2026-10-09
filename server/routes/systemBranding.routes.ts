import { Router, Request, Response } from 'express';
import { SystemSettings } from '../models/SystemSettings.ts';

const router = Router();
const DEFAULT_BRANDING = {
  logoUrl: '',
  slogan: 'SỐNG KHOẺ MỖI NGÀY',
  copyrightLine1: '© <year> Lucky Hub. Bảo mật và đáng tin cậy.',
  copyrightLine2: '',
};

router.get('/branding', async (_req: Request, res: Response) => {
  try {
    const settings = await SystemSettings.findOne({}).select('branding').lean();
    const branding = settings?.branding;
    res.set('Cache-Control', 'no-store');
    res.json({
      logoUrl: branding?.logoUrl ?? DEFAULT_BRANDING.logoUrl,
      slogan: branding?.slogan ?? DEFAULT_BRANDING.slogan,
      copyrightLine1: branding?.copyrightLine1 ?? DEFAULT_BRANDING.copyrightLine1,
      copyrightLine2: branding?.copyrightLine2 ?? DEFAULT_BRANDING.copyrightLine2,
    });
  } catch (error: any) {
    console.error('[SystemBranding] Public configuration fetch failed:', error);
    res.status(500).json({ message: 'Không thể tải thông tin thương hiệu.' });
  }
});

export default router;
