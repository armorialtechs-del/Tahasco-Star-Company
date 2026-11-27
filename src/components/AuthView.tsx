import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  UserCheck,
} from 'lucide-react';
import { useErp } from '../store/erpStore';
import { BrandLogo } from './BrandLogo';

type AuthMode = 'login' | 'forgot' | 'reset';

export const AuthView: React.FC = () => {
  const { db, login, requestPasswordReset, checkResetToken, resetPasswordWithToken } = useErp();

  const [mode, setMode] = useState<AuthMode>('login');

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [generatedResetInfo, setGeneratedResetInfo] = useState<{
    email: string;
    token: string;
    expiresAt: number;
  } | null>(null);

  // Reset password state
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');

  // Support opening reset link directly via ?resetToken=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('resetToken');
    if (tokenFromUrl) {
      setResetToken(tokenFromUrl);
      setMode('reset');
    }
  }, []);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const res = login(identifier, password, rememberMe);
    if (!res.ok) {
      setErrorMsg(res.error);
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setGeneratedResetInfo(null);
    const res = requestPasswordReset(forgotEmail);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    setGeneratedResetInfo({
      email: forgotEmail.trim(),
      token: res.token,
      expiresAt: res.expiresAt,
    });
  };

  const handleOpenResetLink = (token: string) => {
    setErrorMsg('');
    setResetSuccessMsg('');
    setResetToken(token);
    setMode('reset');
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setResetSuccessMsg('');

    const tokenStatus = checkResetToken(resetToken);
    if (!tokenStatus.valid) {
      setErrorMsg(tokenStatus.error);
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    const res = resetPasswordWithToken(resetToken, newPassword);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }

    setResetSuccessMsg('Your password has been updated. You can now sign in with your new password.');
    setNewPassword('');
    setConfirmNewPassword('');
    setResetToken('');
  };


  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Brand & Business Overview Panel */}
      <div className="lg:w-[44%] bg-slate-900 text-white p-8 sm:p-12 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3.5">
            <div className="bg-white rounded-lg p-1.5">
              <BrandLogo
                logoDataUrl={db.settings.logoDataUrl}
                companyName={db.settings.companyName}
                size="md"
              />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                {db.settings.companyName}
              </h1>
              <p className="text-xs text-slate-400">{db.settings.tagline}</p>
            </div>
          </div>

          <div className="mt-12 lg:mt-20 max-w-md">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
              Inventory, Point of Sale &amp; Revenue Operations
            </h2>
            <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed">
              Manage stock levels, process customer sales, print A4 and 80mm thermal receipts,
              and track real-time monthly financial performance across your team.
            </p>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-800 text-xs text-slate-400 space-y-1">
          <p>{db.settings.address}</p>
          <p>
            {db.settings.phone} · {db.settings.email}
          </p>
        </div>
      </div>

      {/* Right Authentication Form Area */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs">
          {mode === 'login' && (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Staff Sign In</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Sign in with your company email or username to access the system.
                </p>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {resetSuccessMsg && (
                <div
                  role="status"
                  className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-2.5"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{resetSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="login-identifier"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Email or Username
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-identifier"
                      type="text"
                      autoComplete="username"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Enter your email or username"
                      required
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <span>Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setResetSuccessMsg('');
                      setMode('forgot');
                    }}
                    className="text-sm font-medium text-teal-700 hover:text-teal-900 cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Sign In to Dashboard</span>
                </button>
              </form>
            </>
          )}

          {mode === 'forgot' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setGeneratedResetInfo(null);
                  setMode('login');
                }}
                className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 mb-5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to sign in</span>
              </button>

              <div className="mb-5">
                <h2 className="text-2xl font-bold text-slate-900">Reset Your Password</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Enter your registered email address to generate a time-limited password reset link.
                </p>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="forgot-email"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Registered Email Address
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="name@tahascostar.com"
                    required
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Send Password Reset Link
                </button>
              </form>

              {generatedResetInfo && (
                <div className="mt-5 p-4 rounded-lg bg-teal-50 border border-teal-200 space-y-2.5">
                  <div className="text-sm font-semibold text-teal-950">
                    Reset link dispatched to {generatedResetInfo.email}
                  </div>
                  <p className="text-xs text-teal-900">
                    Valid for 30 minutes (expires{' '}
                    {new Date(generatedResetInfo.expiresAt).toLocaleTimeString()}). Token:{' '}
                    <span className="font-mono-num font-semibold">{generatedResetInfo.token}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => handleOpenResetLink(generatedResetInfo.token)}
                    className="w-full py-2 px-3 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Open Reset Password Link
                  </button>
                </div>
              )}

              <div className="mt-5 pt-4 border-t border-slate-200 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setMode('reset');
                  }}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Already have a reset token? Enter it manually
                </button>
              </div>
            </>
          )}

          {mode === 'reset' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setMode('login');
                }}
                className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 mb-5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to sign in</span>
              </button>

              <div className="mb-5">
                <h2 className="text-2xl font-bold text-slate-900">Create New Password</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Enter your reset token and choose a new password (minimum 6 characters).
                </p>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {resetSuccessMsg && (
                <div
                  role="status"
                  className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{resetSuccessMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-xs font-semibold underline cursor-pointer"
                  >
                    Return to Sign In
                  </button>
                </div>
              )}

              <form onSubmit={handleResetSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="reset-token"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Reset Token
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="reset-token"
                      type="text"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="RST-XXXXXX-XXXXXX"
                      required
                      className="w-full pl-9 pr-3 py-2.5 text-sm font-mono-num border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="new-password"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      required
                      className="w-full px-3 pr-10 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="confirm-new-password"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Confirm New Password
                  </label>
                  <input
                    id="confirm-new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Update Password
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
