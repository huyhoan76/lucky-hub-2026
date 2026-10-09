export interface SystemBranding {
  logoUrl: string;
  slogan: string;
  copyrightLine1: string;
  copyrightLine2: string;
}

export const DEFAULT_SYSTEM_BRANDING: SystemBranding = {
  logoUrl: '',
  slogan: 'SỐNG KHOẺ MỖI NGÀY',
  copyrightLine1: '© <year> Lucky Hub. Bảo mật và đáng tin cậy.',
  copyrightLine2: '',
};

export function formatCopyrightLine(line: string, year = new Date().getFullYear()): string {
  return line.replace(/-(?=<year>)/gi, '- ').replace(/<year>/gi, String(year));
}
