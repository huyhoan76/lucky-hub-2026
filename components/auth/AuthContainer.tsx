import React, { useState, memo } from 'react';
import Login from './Login';
import Register from './Register';
import ForgotPasswordForm from './ForgotPasswordForm';
import ResetPasswordForm from './ResetPasswordForm';
import EmailVerification from './EmailVerification';
import RegistrationSuccess from './RegistrationSuccess';

type AuthMode = 'login' | 'register' | 'forgot-password' | 'reset-password' | 'verify-email' | 'verify-success' | 'register-success';

interface AuthContainerProps {
  onLogin: (data: any) => void;
  onRegister: (data: any) => void;
  isLoading: boolean;
  emailError: string | null;
  onCheckEmail: (email: string) => void;
  errorMessage?: string | null;
  lockUntil?: string | null;
  verifyMode?: boolean;
  onBackFromVerify?: () => void;
  registeredEmail?: string;
  registrationSuccess?: boolean;
  onClearRegistrationSuccess?: () => void;
}

const AuthContainer: React.FC<AuthContainerProps> = memo(({ onLogin, onRegister, isLoading, emailError, onCheckEmail, errorMessage, lockUntil, verifyMode, onBackFromVerify, registeredEmail, registrationSuccess, onClearRegistrationSuccess }) => {
  const [mode, setMode] = useState<AuthMode>(registrationSuccess ? 'register-success' : verifyMode ? 'verify-success' : 'login');
  const [resetToken, setResetToken] = useState<string>('');

  const handleSwitchToRegister = () => setMode('register');
  const handleSwitchToLogin = () => setMode('login');
  const handleSwitchToForgotPassword = () => setMode('forgot-password');
  const handleResetPasswordSuccess = () => setMode('login');

  const handleResetPassword = (token: string) => {
    setResetToken(token);
    setMode('reset-password');
  };

  // Sync verifyMode prop
  React.useEffect(() => {
    if (verifyMode && mode === 'login') {
      setMode('verify-success');
    }
  }, [verifyMode, mode]);

  // Sync registrationSuccess prop - chuyển sang register-success
  React.useEffect(() => {
    if (registrationSuccess) {
      setMode('register-success');
      // Báo cho App biết đã xử lý để tránh vòng lặp
      if (onClearRegistrationSuccess) {
        onClearRegistrationSuccess();
      }
    }
  }, [registrationSuccess, onClearRegistrationSuccess]);

  // Check if we have a reset token or verify token in URL
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const verifyToken = urlParams.get('verify');
    
    if (token && mode === 'login') {
      // Xóa token khỏi URL sau khi lấy để tránh vòng lặp
      window.history.replaceState({}, document.title, window.location.pathname);
      handleResetPassword(token);
    }
    
    if (verifyToken && mode === 'login') {
      window.history.replaceState({}, document.title, window.location.pathname);
      setResetToken(verifyToken);
      setMode('verify-email');
    }
  }, [mode]);

  const renderAuthForm = () => {
    switch (mode) {
      case 'register':
        return (
          <Register
            onRegister={onRegister}
            onSwitchLogin={handleSwitchToLogin}
            isLoading={isLoading}
            emailError={emailError}
            onCheckEmail={onCheckEmail}
          />
        );
      case 'forgot-password':
        return (
          <ForgotPasswordForm
            onBackToLogin={handleSwitchToLogin}
          />
        );
      case 'reset-password':
        return (
          <ResetPasswordForm
            token={resetToken}
            onSuccess={handleResetPasswordSuccess}
            onBackToLogin={handleSwitchToLogin}
          />
        );
      case 'verify-email':
        return (
          <EmailVerification
            token={resetToken}
            onVerified={handleSwitchToLogin}
            onBackToLogin={handleSwitchToLogin}
          />
        );
      case 'verify-success':
        return (
          <EmailVerification
            token=""
            onVerified={() => setMode('login')}
            onBackToLogin={() => setMode('login')}
          />
        );
      case 'register-success':
        return (
          <RegistrationSuccess
            email={registeredEmail || ''}
            onBackToLogin={() => setMode('login')}
          />
        );
      default:
        return (
          <Login
            onLogin={onLogin}
            onSwitchRegister={handleSwitchToRegister}
            onForgotPassword={handleSwitchToForgotPassword}
            isLoading={isLoading}
            errorMessage={errorMessage}
            lockUntil={lockUntil}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_35%),linear-gradient(135deg,#f4fbf7_0%,#f8fafc_40%,#eef6ff_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center gap-8 lg:gap-12">
        <div className="hidden w-full max-w-xl flex-col justify-center lg:flex">
          <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700 shadow-sm">
            <span>✨</span>
            <span>Wellness platform</span>
          </div>
          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-gradient-to-br from-emerald-500 to-teal-500 shadow-[0_22px_55px_rgba(16,185,129,0.25)]">
              <img src="/favicon/luckyhub.png" alt="Lucky Hub" className="h-10 w-10 object-contain" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Lucky Hub</div>
              <h1 className="mt-1 text-4xl font-black tracking-tight text-slate-800">Sống khỏe với cộng đồng</h1>
            </div>
          </div>
          <p className="max-w-md text-base leading-7 text-slate-600">
            Quản lý chỉ số cơ thể, theo dõi mục tiêu, kết nối cộng đồng và nhận hỗ trợ dinh dưỡng từ đội ngũ chuyên gia trong một hệ thống thống nhất.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ['📊', 'Theo dõi sức khỏe'],
              ['🤝', 'Cộng đồng hỗ trợ'],
              ['🎯', 'Mục tiêu rõ ràng'],
            ].map(([icon, label]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white/75 p-4 shadow-sm">
                <div className="text-2xl">{icon}</div>
                <div className="mt-2 text-sm font-bold text-slate-700">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full max-w-md">
          <a href="/" className="mb-6 block text-center no-underline lg:hidden">
            <div className="flex items-center justify-center mb-4">
              <img src="/favicon/luckyhub.png" alt="Lucky Hub" className="h-24 w-24 object-contain" />
            </div>
            <h1 className="text-3xl font-black text-slate-800">LUCKY HUB</h1>
          </a>

          <div className="rounded-[32px] border border-slate-200 bg-white/85 p-5 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-7">
            {renderAuthForm()}
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-400">© 2026 Lucky Hub. Bảo mật và đáng tin cậy.</p>
          </div>
        </div>
      </div>
    </div>
  );
});

AuthContainer.displayName = 'AuthContainer';

export default AuthContainer;