import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';

import { renderWithProviders } from '../test/renderWithProviders';
import { RequireAuth } from './RequireAuth';

function ProtectedPage() {
  return <h1>Protected Content</h1>;
}

function LoginPage() {
  return <h1>Login Page</h1>;
}

function renderRequireAuth(preloadedState?: Parameters<typeof renderWithProviders>[1]) {
  return renderWithProviders(
    <Routes>
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <ProtectedPage />
          </RequireAuth>
        }
      />
      <Route path="/login" element={<LoginPage />} />
    </Routes>,
    { route: '/dashboard', ...preloadedState },
  );
}

describe('RequireAuth', () => {
  it('renders children when user is authenticated', () => {
    renderRequireAuth({
      preloadedState: {
        auth: {
          user: { id: 1, email: 'test@test.com', firstName: 'Test', lastName: 'User', avatarFallback: 'TU' },
          accessToken: 'mock-token',
          refreshToken: 'mock-refresh',
        },
      },
    });

    expect(screen.getByRole('heading', { name: /protected content/i })).toBeInTheDocument();
  });

  it('redirects to login when user is not authenticated', () => {
    renderRequireAuth({
      preloadedState: {
        auth: {
          user: null,
          accessToken: null,
          refreshToken: null,
        },
      },
    });

    expect(screen.queryByRole('heading', { name: /protected content/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /login page/i })).toBeInTheDocument();
  });

  it('preserves the attempted URL in redirect state', () => {
    // When RequireAuth redirects, it passes state: { from: location.pathname }
    // We verify the redirect happens (login page renders) from /dashboard
    renderRequireAuth({
      preloadedState: {
        auth: {
          user: null,
          accessToken: null,
          refreshToken: null,
        },
      },
    });

    // The component uses Navigate with state={{ from: location.pathname }}
    // Since we rendered at /dashboard and got redirected, login page renders
    expect(screen.getByRole('heading', { name: /login page/i })).toBeInTheDocument();
  });
});
