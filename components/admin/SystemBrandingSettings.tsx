import React, { memo, useCallback, useEffect, useState } from 'react';
import Cropper, { Area, Point } from 'react-easy-crop';
import BrandFooter from '../system/BrandFooter.tsx';
import { DEFAULT_SYSTEM_BRANDING, SystemBranding } from '../../utils/systemBranding.ts';

const DEFAULT_LOGO = '/favicon/luckyhub.png';

const SystemBrandingSettings: React.FC = () => {
  const [branding, setBranding] = useState<SystemBranding>(DEFAULT_SYSTEM_BRANDING);
  const [pendingLogo, setPendingLogo] = useState<string | null>(null);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const getAuthHeaders = useCallback(() => {
    const sessionId = localStorage.getItem('lucky_hub_session');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionId}`,
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadBranding = async () => {
      try {
        const response = await fetch('/api/admin/system-branding', { headers: getAuthHeaders() });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Không thể tải thông tin thương hiệu.');
        if (isMounted) {
          setBranding({ ...DEFAULT_SYSTEM_BRANDING, ...data });
          setHasLoaded(true);
        }
      } catch (loadError: any) {
        console.error('[SystemBranding] Load failed:', loadError);
        if (isMounted) setError(loadError.message || 'Không thể tải thông tin thương hiệu.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadBranding();
    return () => { isMounted = false; };
  }, [getAuthHeaders]);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn tệp hình ảnh.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Ảnh gốc phải có dung lượng tối đa 10 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setError(null);
        setSourceImage(reader.result);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
      }
    };
    reader.onerror = () => setError('Không thể đọc tệp hình ảnh.');
    reader.readAsDataURL(file);
  };

  const cropImage = async () => {
    if (!sourceImage || !croppedAreaPixels) return;
    setError(null);
    try {
      const image = new Image();
      const imageReady = new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Không thể xử lý ảnh đã chọn.'));
      });
      image.src = sourceImage;
      await imageReady;

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.');
      canvas.width = 512;
      canvas.height = 512;
      context.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      setPendingLogo(canvas.toDataURL('image/png'));
      setSourceImage(null);
    } catch (cropError: any) {
      console.error('[SystemBranding] Crop failed:', cropError);
      setError(cropError.message || 'Không thể cắt ảnh.');
    }
  };

  const saveBranding = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      let logoUrl = branding.logoUrl;
      if (pendingLogo) {
        const uploadResponse = await fetch('/api/admin/system-branding/logo', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ imageData: pendingLogo }),
        });
        const uploadData = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(uploadData.message || 'Không thể tải logo lên storage.');
        logoUrl = uploadData.logoUrl;
      }

      const response = await fetch('/api/admin/system-branding', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...branding, logoUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Không thể lưu thông tin thương hiệu.');

      const nextBranding = { ...DEFAULT_SYSTEM_BRANDING, ...data.branding };
      setBranding(nextBranding);
      setPendingLogo(null);
      window.dispatchEvent(new CustomEvent<SystemBranding>('system-branding-updated', { detail: nextBranding }));
      setSuccess('Đã lưu thông tin thương hiệu.');
      console.log('[SystemBranding] Settings saved.');
    } catch (saveError: any) {
      console.error('[SystemBranding] Save failed:', saveError);
      setError(saveError.message || 'Không thể lưu thông tin thương hiệu.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateBranding = (field: keyof SystemBranding, value: string) => {
    setBranding(previous => ({ ...previous, [field]: value }));
  };

  const previewLogo = pendingLogo || branding.logoUrl || DEFAULT_LOGO;

  if (isLoading) return <div className="p-8 text-center text-slate-400">Đang tải thông tin thương hiệu...</div>;

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h4 className="mb-4 font-black text-slate-700">Thông tin thương hiệu</h4>
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <div className="space-y-3">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500">Logo chính</label>
            <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <img src={previewLogo} alt="Xem trước logo hệ thống" className="h-full w-full object-contain" />
            </div>
            <label className="inline-flex cursor-pointer rounded-xl bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-200">
              Chọn ảnh và cắt
              <input type="file" accept="image/*" className="sr-only" onChange={handleImageSelect} />
            </label>
            {(branding.logoUrl || pendingLogo) && (
              <button
                type="button"
                onClick={() => { setPendingLogo(null); updateBranding('logoUrl', ''); }}
                className="ml-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200"
              >
                Dùng logo mặc định
              </button>
            )}
            <p className="text-xs leading-5 text-slate-500">Logo được cắt vuông và tải lên storage provider đang bật.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="system-slogan" className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">Slogan</label>
              <input
                id="system-slogan"
                maxLength={120}
                value={branding.slogan}
                onChange={event => updateBranding('slogan', event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="SỐNG KHOẺ MỖI NGÀY"
              />
            </div>
            <div>
              <label htmlFor="system-copyright-line-1" className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">Copyright - dòng 1</label>
              <input
                id="system-copyright-line-1"
                maxLength={300}
                value={branding.copyrightLine1}
                onChange={event => updateBranding('copyrightLine1', event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="© 2025-<year> Lucky Hub"
              />
            </div>
            <div>
              <label htmlFor="system-copyright-line-2" className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">Copyright - dòng 2</label>
              <input
                id="system-copyright-line-2"
                maxLength={300}
                value={branding.copyrightLine2}
                onChange={event => updateBranding('copyrightLine2', event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Thông tin bổ sung (không bắt buộc)"
              />
            </div>
            <p className="text-xs text-slate-500">Dùng <code>&lt;year&gt;</code> để tự động hiển thị năm hiện tại. Ví dụ: <code>© 2025-&lt;year&gt;</code>.</p>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Xem trước footer</p>
              <BrandFooter branding={branding} className="space-y-1 text-xs text-slate-500" />
            </div>
          </div>
        </div>

        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p>}
        {success && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{success}</p>}
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={saveBranding}
            disabled={isSaving || !hasLoaded}
            className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu thông tin'}
          </button>
        </div>
      </div>

      {sourceImage && (
        <div className="fixed inset-0 z-[1000] flex flex-col bg-slate-950/90 p-4 sm:p-10" role="dialog" aria-modal="true" aria-label="Cắt ảnh logo">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-slate-800">
            <Cropper
              image={sourceImage}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          {error && <p role="alert" className="mx-auto mt-3 w-full max-w-lg text-sm font-medium text-rose-200">{error}</p>}
          <div className="mx-auto mt-5 flex w-full max-w-lg flex-col gap-4">
            <label className="flex items-center gap-3 text-sm font-medium text-white">
              Thu phóng
              <input type="range" min="1" max="3" step="0.1" value={zoom} onChange={event => setZoom(Number(event.target.value))} className="flex-1" />
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setSourceImage(null)} className="flex-1 rounded-xl bg-slate-700 px-4 py-3 font-bold text-white">Hủy</button>
              <button type="button" onClick={cropImage} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white">Xác nhận cắt</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

SystemBrandingSettings.displayName = 'SystemBrandingSettings';

export default memo(SystemBrandingSettings);
