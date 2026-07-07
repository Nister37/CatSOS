import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';

import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { signupSchema, type SignupFormData } from '../schemas/authSchema';
import { register as registerApi } from '../api/auth';
import { useSsoLogin } from '../api/useSsoLogin';
import { addNotification } from '../features/notifications/notificationsSlice';
import { useAppDispatch } from '../app/hooks';

export function SignupPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { loginWithGoogle, loginWithMicrosoft, ssoLoading, ssoError } = useSsoLogin();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormData) => {
    try {
      await registerApi(data.email, data.password, data.passwordConfirm);
      dispatch(addNotification('Account created! Please verify your email.', 'success'));
      navigate('/verify-email', { state: { email: data.email } });
    } catch (err: unknown) {
      const apiError = err as Record<string, string[]>;
      if (Array.isArray(apiError.email)) {
        setError('email', { message: apiError.email[0] });
      } else if (Array.isArray(apiError.password)) {
        setError('password', { message: apiError.password[0] });
      } else if (Array.isArray(apiError.password_confirm)) {
        setError('passwordConfirm', { message: apiError.password_confirm[0] });
      } else {
        setError('root', { message: 'Registration failed. Please try again.' });
      }
    }
  };

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col">
      <Navbar />

      <main className="min-h-screen pt-32 pb-xl px-margin-mobile flex items-center justify-center relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary-container opacity-5 blur-[120px] rounded-full" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-on-background opacity-5 blur-[120px] rounded-full" />

        {/* Registration card */}
        <div className="w-full max-w-md bg-surface-container-lowest p-lg rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] z-10">
          <div className="text-center mb-lg">
            <h1 className="font-headline-lg text-headline-lg text-on-background mb-xs">
              Join the Community
            </h1>
            <p className="font-body-md text-body-md text-secondary">
              Be part of the safety net for our feline friends.
            </p>
          </div>

          <form className="space-y-md" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="space-y-xs">
              <label
                htmlFor="email"
                className="font-label-md text-label-md text-on-surface-variant block"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="jane@example.com"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className="w-full bg-surface-container-low border-none rounded-lg p-md focus:ring-2 focus:ring-on-background transition-all placeholder:text-secondary-fixed-dim"
                {...register('email')}
              />
              {errors.email && (
                <p id="email-error" role="alert" className="text-error text-label-sm">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-xs">
              <label
                htmlFor="password"
                className="font-label-md text-label-md text-on-surface-variant block"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className="w-full bg-surface-container-low border-none rounded-lg p-md focus:ring-2 focus:ring-on-background transition-all placeholder:text-secondary-fixed-dim"
                {...register('password')}
              />
              {errors.password && (
                <p id="password-error" role="alert" className="text-error text-label-sm">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-xs">
              <label
                htmlFor="passwordConfirm"
                className="font-label-md text-label-md text-on-surface-variant block"
              >
                Confirm Password
              </label>
              <input
                id="passwordConfirm"
                type="password"
                placeholder="••••••••"
                aria-invalid={Boolean(errors.passwordConfirm)}
                aria-describedby={errors.passwordConfirm ? 'passwordConfirm-error' : undefined}
                className="w-full bg-surface-container-low border-none rounded-lg p-md focus:ring-2 focus:ring-on-background transition-all placeholder:text-secondary-fixed-dim"
                {...register('passwordConfirm')}
              />
              {errors.passwordConfirm && (
                <p id="passwordConfirm-error" role="alert" className="text-error text-label-sm">
                  {errors.passwordConfirm.message}
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
              className="w-full bg-primary text-on-primary font-label-md text-label-md py-md rounded-lg shadow-md hover:brightness-110 active:scale-95 transition-all mt-sm disabled:opacity-60"
            >
              {isSubmitting ? 'Creating Account…' : 'Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-lg">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-container-high" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-surface-container-lowest px-md text-secondary font-label-sm text-label-sm">
                OR CONTINUE WITH
              </span>
            </div>
          </div>

          {/* Google SSO */}
          <button
            type="button"
            onClick={loginWithGoogle}
            disabled={ssoLoading === 'google'}
            className="w-full bg-on-background text-on-primary font-label-md text-label-md py-md rounded-lg flex items-center justify-center gap-base hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
          >
            {ssoLoading === 'google' ? (
              <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="currentColor"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="currentColor"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="currentColor"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="currentColor"
                />
              </svg>
            )}
            Sign up with Google
          </button>

          {/* Microsoft SSO */}
          <button
            type="button"
            onClick={loginWithMicrosoft}
            disabled={ssoLoading === 'microsoft'}
            className="w-full bg-on-background text-on-primary font-label-md text-label-md py-md rounded-lg flex items-center justify-center gap-base hover:opacity-90 active:scale-95 transition-all mt-sm disabled:opacity-60"
          >
            {ssoLoading === 'microsoft' ? (
              <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 21 21">
                <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
              </svg>
            )}
            Sign up with Microsoft
          </button>

          {/* SSO configuration error */}
          {ssoError && (
            <div role="alert" className="w-full mt-sm p-sm bg-error/10 border border-error/30 rounded-lg">
              <p className="text-error text-label-sm text-center">{ssoError}</p>
            </div>
          )}

          {/* Log in redirect */}
          <div className="mt-lg text-center">
            <p className="font-body-md text-body-md text-secondary">
              Already have an account?{' '}
              <Link className="text-primary font-bold hover:underline" to="/login">
                Log In
              </Link>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
