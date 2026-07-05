import { Link } from 'react-router-dom';

import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export function LoginPage() {
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
              <h1 className="font-headline-lg text-headline-lg text-on-background mb-xs">Welcome Back</h1>
              <p className="font-body-md text-body-md text-secondary">Helping you keep your community safe.</p>
            </div>

            {/* Form */}
            <form className="w-full space-y-md">
              <div className="flex flex-col gap-xs">
                <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="email">
                  Email Address
                </label>
                <input
                  className="bg-surface-container-low border-2 border-transparent rounded-lg px-md py-sm font-body-md text-body-md transition-all duration-200 focus:outline-none focus:border-on-background focus:bg-white"
                  id="email"
                  placeholder="name@example.com"
                  required
                  type="email"
                />
              </div>

              <div className="flex flex-col gap-xs">
                <div className="flex justify-between items-center">
                  <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="password">
                    Password
                  </label>
                  <a className="font-label-sm text-label-sm text-primary hover:underline" href="#">
                    Forgot?
                  </a>
                </div>
                <input
                  className="bg-surface-container-low border-2 border-transparent rounded-lg px-md py-sm font-body-md text-body-md transition-all duration-200 focus:outline-none focus:border-on-background focus:bg-white"
                  id="password"
                  placeholder="••••••••"
                  required
                  type="password"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-primary-container text-on-primary font-label-md text-label-md py-md rounded-lg hover:brightness-110 active:scale-[0.98] transition-all shadow-sm flex justify-center items-center gap-base"
              >
                Log In
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </form>

            {/* Divider */}
            <div className="w-full flex items-center gap-md my-lg">
              <div className="h-[1px] flex-grow bg-surface-container" />
              <span className="font-label-sm text-label-sm text-tertiary">or continue with</span>
              <div className="h-[1px] flex-grow bg-surface-container" />
            </div>

            {/* Google SSO */}
            <button className="w-full flex items-center justify-center gap-md bg-surface-container-lowest border border-surface-container py-md rounded-lg font-label-md text-label-md text-on-background hover:bg-surface-container-low active:scale-[0.98] transition-all">
              <svg height="20" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
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
          <div className="mt-lg flex justify-center items-center gap-xs text-tertiary opacity-40">
            <span className="material-symbols-outlined text-[16px]">verified_user</span>
            <span className="font-label-sm text-label-sm uppercase tracking-widest">Secure Connection</span>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
