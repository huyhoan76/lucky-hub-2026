import React, { memo } from 'react';
import { SystemBranding, formatCopyrightLine } from '../../utils/systemBranding.ts';

interface BrandFooterProps {
  branding: SystemBranding;
  className?: string;
}

const BrandFooter: React.FC<BrandFooterProps> = memo(({ branding, className = '' }) => {
  const lines = [branding.copyrightLine1, branding.copyrightLine2]
    .map(line => formatCopyrightLine(line.trim()))
    .filter(Boolean);

  if (!lines.length) return null;

  return (
    <footer className={className} aria-label="Thông tin bản quyền">
      {lines.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
    </footer>
  );
});

BrandFooter.displayName = 'BrandFooter';

export default BrandFooter;
