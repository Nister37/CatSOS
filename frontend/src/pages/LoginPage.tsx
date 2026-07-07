import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';

import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { loginSchema, type LoginFormData } from '../schemas/authSchema';
import { login, getMe } from '../api/auth';
import { useSsoLogin } from '../api/useSsoLogin';
import { setCredentials, setAccessToken } from '../features/auth/authSlice';
import { addNotification } from '../features/notifications/notificationsSlice';
import { useAppDispatch } from '../app/hooks';

export function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { loginWithGoogle, loginWithMicrosoft, ssoLoading } = useSsoLogin();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      const authRes = await login(data.email, data.password);
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
      dispatch(addNotification('Welcome back!', 'success'));
      navigate('/');
    } catch (err: unknown) {
      const apiError = err as Record<string, string[]>;
      if (Array.isArray(apiError.email)) {
        setError('email', { message: apiError.email[0] });
      } else if (Array.isArray(apiError.non_field_errors)) {
        setError('root', { message: apiError.non_field_errors[0] });
      } else {
        setError('root', { message: 'Login failed. Please try again.' });
      }
    }
  };

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow flex items-center justify-center pt-24 pb-xl px-margin-mobile">
        {/* Background decoration */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute bottom-[0%] right-[0%] w-[30%] h-[30%] rounded-full bg-on-background/5 blur-[100px]" />
        </div>

        <div className="w-full max-w-[440px]">
          <div className="bg-surface-container-lowest rounded-xl p-lg shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-surface-container flex flex-col items-center">
            {/* Headline */}
            <div className="text-center mb-lg">
              <h1 className="font-headline-lg text-headline-lg text-on-background mb-xs">
                Welcome Back
              </h1>
              <p className="font-body-md text-body-md text-secondary">
                Helping you keep your community safe.
              </p>
            </div>

            {/* Form */}
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

              <div className="flex flex-col gap-xs">
                <div className="flex justify-between items-center">
                  <label
                    className="font-label-md text-label-md text-on-surface-variant"
                    htmlFor="password"
                  >
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="font-label-sm text-label-sm text-primary hover:underline"
                  >
                    Forgot?
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  className="bg-surface-container-low border-2 border-transparent rounded-lg px-md py-sm font-body-md text-body-md transition-all duration-200 focus:outline-none focus:border-on-background focus:bg-white"
                  {...register('password')}
                />
                {errors.password && (
                  <p id="password-error" role="alert" className="text-error text-label-sm">
                    {errors.password.message}
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
                {isSubmitting ? 'Logging in…' : 'Log In'}
                {!isSubmitting && (
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="w-full flex items-center gap-md my-lg">
              <div className="h-[1px] flex-grow bg-surface-container" />
              <span className="font-label-sm text-label-sm text-tertiary">or continue with</span>
              <div className="h-[1px] flex-grow bg-surface-container" />
            </div>

            {/* Google SSO */}
            <button
              type="button"
              onClick={loginWithGoogle}
              disabled={ssoLoading === 'google'}
              className="w-full flex items-center justify-center gap-md bg-surface-container-lowest border border-surface-container py-md rounded-lg font-label-md text-label-md text-on-background hover:bg-surface-container-low active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {ssoLoading === 'google' ? (
                <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
              ) : (
                <svg height="20" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              Continue with Google
            </button>

            {/* Microsoft SSO */}
            <button
              type="button"
              onClick={loginWithMicrosoft}
              disabled={ssoLoading === 'microsoft'}
              className="w-full flex items-center justify-center gap-md bg-surface-container-lowest border border-surface-container py-md rounded-lg font-label-md text-label-md text-on-background hover:bg-surface-container-low active:scale-[0.98] transition-all mt-sm disabled:opacity-60"
            >
              {ssoLoading === 'microsoft' ? (
                <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
              ) : (
                <svg height="20" viewBox="0 0 21 21" width="20" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                  <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                </svg>
              )}
              Continue with Microsoft
            </button>

            {/* Sign up redirect */}
            <div className="mt-xl text-center">
              <p className="font-body-md text-body-md text-tertiary">
                Don't have an account?{' '}
                <Link className="text-primary font-bold hover:underline" to="/signup">
                  Sign Up
                </Link>
              </p>
            </div>
          </div>

          {/* Secure badge */}
          <div className="mt-lg flex justify-center items-center gap-xs text-tertiary">
            <span className="material-symbols-outlined text-[16px]">verified_user</span>
            <span className="font-label-sm text-label-sm uppercase tracking-widest">
              Secure Connection
            </span>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
