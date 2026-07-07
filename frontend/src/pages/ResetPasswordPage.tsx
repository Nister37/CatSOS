import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { resetPasswordSchema, type ResetPasswordFormData } from '../schemas/authSchema';
import { confirmPasswordReset } from '../api/auth';
import { addNotification } from '../features/notifications/notificationsSlice';
import { useAppDispatch } from '../app/hooks';

export function ResetPasswordPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const uid = searchParams.get('uid') ?? '';
  const token = searchParams.get('token') ?? '';
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  if (!uid || !token) {
    return (
      <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow flex items-center justify-center px-margin-mobile">
          <div className="text-center space-y-md">
            <span className="material-symbols-outlined text-[64px] text-secondary block">link_off</span>
            <h1 className="font-headline-md text-headline-md text-on-surface">Invalid reset link</h1>
            <p className="font-body-md text-body-md text-secondary">
              This link is missing required parameters.
            </p>
            <Link
              to="/forgot-password"
              className="inline-flex items-center gap-xs text-primary font-label-md hover:underline"
            >
              Request a new reset link
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      await confirmPasswordReset(uid, token, data.newPassword, data.newPasswordConfirm);
      dispatch(addNotification('Password reset successfully. You can now log in.', 'success'));
      navigate('/login');
    } catch (err: unknown) {
      const apiError = err as Record<string, unknown>;
      if (Array.isArray(apiError.new_password)) {
        setError('newPassword', { message: (apiError.new_password as string[])[0] });
      } else if (typeof apiError.detail === 'string') {
        setError('root', { message: apiError.detail });
      } else {
        setError('root', {
          message: 'This reset link is invalid or has expired. Please request a new one.',
        });
      }
    }
  };

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow flex items-center justify-center pt-24 pb-xl px-margin-mobile">
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
          <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
        </div>

        <div className="w-full max-w-[440px]">
          <div className="bg-surface-container-lowest rounded-xl p-lg shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-surface-container flex flex-col items-center">
            <div className="text-center mb-lg w-full">
              <span className="material-symbols-outlined text-4xl text-primary mb-sm block">
                lock_open
              </span>
              <h1 className="font-headline-lg text-headline-lg text-on-background mb-xs">
                Set New Password
              </h1>
              <p className="font-body-md text-body-md text-secondary">
                Choose a strong password of at least 8 characters.
              </p>
            </div>

            <form className="w-full space-y-md" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="flex flex-col gap-xs">
                <label
                  className="font-label-md text-label-md text-on-surface-variant"
                  htmlFor="newPassword"
                >
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    type={showNew ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors.newPassword)}
                    aria-describedby={errors.newPassword ? 'newPassword-error' : undefined}
                    className="w-full bg-surface-container-low border-2 border-transparent rounded-lg px-md py-sm pr-12 font-body-md text-body-md transition-all duration-200 focus:outline-none focus:border-on-background focus:bg-white"
                    {...register('newPassword')}
                  />
                  <button
                    type="button"
                    aria-label={showNew ? 'Hide password' : 'Show password'}
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showNew ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                {errors.newPassword && (
                  <p id="newPassword-error" role="alert" className="text-error text-label-sm">
                    {errors.newPassword.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-xs">
                <label
                  className="font-label-md text-label-md text-on-surface-variant"
                  htmlFor="newPasswordConfirm"
                >
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="newPasswordConfirm"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors.newPasswordConfirm)}
                    aria-describedby={errors.newPasswordConfirm ? 'newPasswordConfirm-error' : undefined}
                    className="w-full bg-surface-container-low border-2 border-transparent rounded-lg px-md py-sm pr-12 font-body-md text-body-md transition-all duration-200 focus:outline-none focus:border-on-background focus:bg-white"
                    {...register('newPasswordConfirm')}
                  />
                  <button
                    type="button"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showConfirm ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                {errors.newPasswordConfirm && (
                  <p id="newPasswordConfirm-error" role="alert" className="text-error text-label-sm">
                    {errors.newPasswordConfirm.message}
                  </p>
                )}
              </div>

              {errors.root && (
                <div className="space-y-xs">
                  <p role="alert" className="text-error text-label-sm text-center">
                    {errors.root.message}
                  </p>
                  <div className="text-center">
                    <Link
                      to="/forgot-password"
                      className="text-primary font-label-sm text-label-sm hover:underline"
                    >
                      Request a new reset link
                    </Link>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary text-on-primary font-label-md text-label-md py-md rounded-lg hover:brightness-110 active:scale-[0.98] transition-all shadow-sm flex justify-center items-center gap-base disabled:opacity-60"
              >
                {isSubmitting ? 'Resetting…' : 'Reset Password'}
                {!isSubmitting && (
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
