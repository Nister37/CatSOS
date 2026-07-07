import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';

import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '../schemas/authSchema';
import { requestPasswordReset } from '../api/auth';

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      await requestPasswordReset(data.email);
      setSentEmail(data.email);
      setSent(true);
    } catch (err: unknown) {
      const apiError = err as Record<string, unknown>;
      if (typeof apiError.detail === 'string' && apiError.detail.toLowerCase().includes('rate')) {
        setError('root', { message: 'Too many requests. Please wait a while before trying again.' });
      } else {
        // Always show the "check your email" message even on error — prevents user enumeration
        setSentEmail(data.email);
        setSent(true);
      }
    }
  };

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow flex items-center justify-center pt-24 pb-xl px-margin-mobile">
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[30%] h-[30%] rounded-full bg-on-background/5 blur-[100px]" />
        </div>

        <div className="w-full max-w-[440px]">
          <div className="bg-surface-container-lowest rounded-xl p-lg shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-surface-container flex flex-col items-center">

            {sent ? (
              /* Success state */
              <div className="text-center space-y-md py-sm">
                <span className="material-symbols-outlined text-5xl text-primary block">
                  mark_email_read
                </span>
                <h1 className="font-headline-lg text-headline-lg text-on-background">
                  Check your inbox
                </h1>
                <p className="font-body-md text-body-md text-secondary">
                  If an account exists for{' '}
                  <strong className="text-on-surface">{sentEmail}</strong>, you'll receive a
                  password reset link shortly.
                </p>
                <p className="font-body-sm text-body-sm text-secondary">
                  The link expires after a short time. Check your spam folder if you don't see it.
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-xs text-primary font-label-md text-label-md hover:underline mt-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  Back to login
                </Link>
              </div>
            ) : (
              /* Form state */
              <>
                <div className="text-center mb-lg w-full">
                  <span className="material-symbols-outlined text-4xl text-primary mb-sm block">
                    lock_reset
                  </span>
                  <h1 className="font-headline-lg text-headline-lg text-on-background mb-xs">
                    Forgot Password?
                  </h1>
                  <p className="font-body-md text-body-md text-secondary">
                    Enter your email and we'll send you a reset link.
                  </p>
                </div>

                <form className="w-full space-y-md" onSubmit={handleSubmit(onSubmit)} noValidate>
                  <div className="flex flex-col gap-xs">
                    <label
                      className="font-label-md text-label-md text-on-surface-variant"
                      htmlFor="email"
                    >
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      autoComplete="email"
                      autoFocus
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? 'email-error' : undefined}
                      className="bg-surface-container-low border-2 border-transparent rounded-lg px-md py-sm font-body-md text-body-md transition-all duration-200 focus:outline-none focus:border-on-background focus:bg-white"
                      {...register('email')}
                    />
                    {errors.email && (
                      <p id="email-error" role="alert" className="text-error text-label-sm">
                        {errors.email.message}
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
                    {isSubmitting ? 'Sending…' : 'Send Reset Link'}
                    {!isSubmitting && (
                      <span className="material-symbols-outlined text-[18px]">send</span>
                    )}
                  </button>
                </form>

                <div className="mt-lg text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-xs text-secondary font-label-md text-label-md hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    Back to login
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
