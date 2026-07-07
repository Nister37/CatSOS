import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { verifyEmailSchema, type VerifyEmailFormData } from '../schemas/authSchema';
import { verifyEmail, getMe, resendVerification } from '../api/auth';
import { setCredentials, setAccessToken } from '../features/auth/authSlice';
import { addNotification } from '../features/notifications/notificationsSlice';
import { useAppDispatch } from '../app/hooks';

const RESEND_COOLDOWN_S = 60;

export function EmailVerificationPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email ?? '';
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startCooldown(seconds: number) {
    setResendCooldown(seconds);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  async function handleResend() {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    try {
      await resendVerification(email);
      dispatch(addNotification('Verification code resent. Check your inbox.', 'success'));
      startCooldown(RESEND_COOLDOWN_S);
    } catch (err: unknown) {
      const apiError = err as Record<string, unknown>;
      if (Array.isArray(apiError.resend_available_in_seconds)) {
        const wait = Number(apiError.resend_available_in_seconds[0]);
        startCooldown(wait);
        dispatch(addNotification(`Please wait ${wait}s before resending.`, 'warning'));
      } else {
        dispatch(addNotification('Failed to resend code. Please try again.', 'error'));
      }
    } finally {
      setResending(false);
    }
  }

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<VerifyEmailFormData>({
    resolver: zodResolver(verifyEmailSchema),
  });

  const onSubmit = async (data: VerifyEmailFormData) => {
    try {
      const authRes = await verifyEmail(email, data.code);
      dispatch(setAccessToken({ accessToken: authRes.access, refreshToken: authRes.refresh }));
      const me = await getMe();
      dispatch(
        setCredentials({
          user: {
            id: me.id,
            email: me.email,
            firstName: me.first_name,
            lastName: me.last_name,
            avatarFallback: me.avatar_fallback,
          },
          accessToken: authRes.access,
          refreshToken: authRes.refresh,
        }),
      );
      dispatch(addNotification('Email verified! Welcome to CatSOS.', 'success'));
      navigate('/');
    } catch (err: unknown) {
      const apiError = err as Record<string, string[]>;
      if (Array.isArray(apiError.code)) {
        setError('code', { message: apiError.code[0] });
      } else if (Array.isArray(apiError.non_field_errors)) {
        setError('root', { message: apiError.non_field_errors[0] });
      } else {
        setError('root', { message: 'Verification failed. Please try again.' });
      }
    }
  };

  if (!email) {
    return (
      <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow flex items-center justify-center px-margin-mobile">
          <div className="text-center">
            <p className="font-body-md text-body-md text-secondary mb-md">No email address found.</p>
            <Link className="text-primary font-bold hover:underline" to="/signup">
              Back to Sign Up
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow flex items-center justify-center pt-24 pb-xl px-margin-mobile">
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
          <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
        </div>

        <div className="w-full max-w-[440px]">
          <div className="bg-surface-container-lowest rounded-xl p-lg shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-surface-container flex flex-col items-center">
            <div className="text-center mb-lg">
              <span className="material-symbols-outlined text-4xl text-primary mb-sm block">
                mark_email_read
              </span>
              <h1 className="font-headline-lg text-headline-lg text-on-background mb-xs">
                Check Your Inbox
              </h1>
              <p className="font-body-md text-body-md text-secondary">
                We sent an 8-digit code to <strong>{email}</strong>
              </p>
            </div>

            <form className="w-full space-y-md" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="flex flex-col gap-xs">
                <label
                  className="font-label-md text-label-md text-on-surface-variant"
                  htmlFor="code"
                >
                  Verification Code
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="12345678"
                  autoComplete="one-time-code"
                  aria-invalid={Boolean(errors.code)}
                  aria-describedby={errors.code ? 'code-error' : undefined}
                  className="bg-surface-container-low border-2 border-transparent rounded-lg px-md py-sm font-body-md text-body-md text-center tracking-widest transition-all duration-200 focus:outline-none focus:border-on-background focus:bg-white"
                  {...register('code')}
                />
                {errors.code && (
                  <p id="code-error" role="alert" className="text-error text-label-sm">
                    {errors.code.message}
                  </p>
                )}
              </div>

              {errors.root && (
                <p role="alert" className="text-error text-label-sm text-center">
                  {errors.root.message}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary text-on-primary font-label-md text-label-md py-md rounded-lg hover:brightness-110 active:scale-[0.98] transition-all shadow-sm flex justify-center items-center gap-base disabled:opacity-60"
              >
                {isSubmitting ? 'Verifying…' : 'Verify Email'}
                {!isSubmitting && (
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                )}
              </button>
            </form>

            <div className="mt-lg text-center space-y-xs">
              <p className="font-body-md text-body-md text-tertiary">
                Didn't receive the code?
              </p>
              <button
                type="button"
                disabled={resendCooldown > 0 || resending}
                onClick={handleResend}
                className="text-primary font-label-md text-label-md hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resending
                  ? 'Sending…'
                  : resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : 'Resend code'}
              </button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
