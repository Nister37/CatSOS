import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from './App';
import { renderWithProviders } from './test/renderWithProviders';

jest.mock('./services/reportsApi', () => ({
  fetchPublicReports: jest.fn().mockResolvedValue([
    { public_id: 'r1', cat_name: 'Milo', main_photo: { url: 'https://example.com/milo.jpg' }, location_summary: 'Downtown', last_seen_landmark: '', disappeared_at: null, status: 'MISSING' },
  ]),
  fetchReportDetail: jest.fn().mockResolvedValue(null),
}));

describe('ScrollToTop', () => {
  it('calls window.scrollTo(0,0) on route change', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { route: '/login' });

    await user.click(screen.getByRole('link', { name: /sign up/i }));
    await screen.findByRole('heading', { name: /join the community/i });

    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });
});

describe('App', () => {
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = 'en';
  });

  it('renders the public home page', async () => {
    renderWithProviders(<App />);

    expect(screen.getByRole('heading', { name: /lost your cat/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /recently reported/i })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /milo, a missing cat/i })).toBeInTheDocument();
  });

  it('toggles the public mobile navigation menu state', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    const menuButton = screen.getByRole('button', { name: /open menu/i });

    expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    await user.click(menuButton);

    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(menuButton).toHaveAccessibleName(/close menu/i);
  });

  it('renders the dashboard route', () => {
    renderWithProviders(<App />, { route: '/dashboard' });

    expect(screen.getByRole('heading', { name: /field dashboard/i })).toBeInTheDocument();
  });

  it('renders the not found route', () => {
    renderWithProviders(<App />, { route: '/does-not-exist' });

    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /return to dashboard/i })).toHaveAttribute('href', '/');
  });

  it('shows a sign-in link when logged out and a sign-out button when logged in', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, {
      route: '/dashboard',
      preloadedState: {
        auth: {
          user: { id: 1, email: 'coord@example.com', firstName: 'Jane', lastName: 'Doe', avatarFallback: 'JD' },
          accessToken: 'tok',
          refreshToken: 'rtok',
        },
      },
    });

    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /sign out/i }));
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  it('updates the language control in the app layout', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { route: '/dashboard' });

    await user.selectOptions(screen.getByLabelText(/language/i), 'nl');
    expect(document.documentElement.lang).toBe('nl');
    expect(window.localStorage.getItem('catsos.language')).toBe('nl');
  });

  it('loads a stored language preference on app render', () => {
    window.localStorage.setItem('catsos.language', 'pl');
    renderWithProviders(<App />, { route: '/dashboard' });

    expect(screen.getByLabelText(/language/i)).toHaveValue('pl');
    expect(document.documentElement.lang).toBe('pl');
  });

  it('navigates between login and signup routes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { route: '/login' });

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /sign up/i }));
    expect(await screen.findByRole('heading', { name: /join the community/i })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /log in/i }));
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });

  it('shows validation errors on empty signup submission', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { route: '/signup' });

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByRole('heading', { name: /join the community/i })).toBeInTheDocument();
    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument();
  });

  it('shows validation errors for an incomplete intake report', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { route: '/intake' });

    await user.click(screen.getByRole('button', { name: /submit report/i }));

    expect(await screen.findByText(/enter at least 2 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(screen.getByText(/enter at least 10 characters/i)).toBeInTheDocument();
  });

  it('validates and submits an intake report', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { route: '/intake' });

    await user.type(screen.getByLabelText(/cat name/i), 'Miso');
    await user.type(screen.getByLabelText(/reporter email/i), 'rescue@example.com');
    await user.selectOptions(screen.getByLabelText(/urgency/i), 'high');
    await user.type(screen.getByLabelText(/situation/i), 'Small cat found near a busy road.');
    await user.click(screen.getByRole('button', { name: /submit report/i }));

    expect(screen.getByText(/report queued for review/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText(/report queued for review/i)).not.toBeInTheDocument();
  });
});
