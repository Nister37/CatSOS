import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../test/renderWithProviders';
import { ReportSightingPage } from './ReportSightingPage';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/report-sighting', search: '', hash: '', key: 'default', state: null }),
}));

jest.mock('../services/reportsApi', () => ({
  fetchPublicReports: jest.fn().mockResolvedValue([
    { public_id: 'abc-1', cat_name: 'Oliver', main_photo: null, location_summary: '', last_seen_landmark: '', disappeared_at: null, status: 'MISSING' },
    { public_id: 'abc-2', cat_name: 'Luna',   main_photo: null, location_summary: '', last_seen_landmark: '', disappeared_at: null, status: 'MISSING' },
  ]),
  createSighting: jest.fn().mockResolvedValue(undefined),
}));

const AUTH_STATE = {
  auth: {
    user: { id: 1, email: 'test@test.com', firstName: 'Test', lastName: 'User', avatarFallback: 'TU' },
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  global.URL.createObjectURL = jest.fn(() => 'blob:mock-preview-url');
  global.URL.revokeObjectURL = jest.fn();
});

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('ReportSightingPage — rendering', () => {
  it('renders the page heading', () => {
    renderWithProviders(<ReportSightingPage />);
    expect(screen.getByRole('heading', { name: /report a sighting/i })).toBeInTheDocument();
  });

  it('renders a loading skeleton then cat cards from the API', async () => {
    renderWithProviders(<ReportSightingPage />);
    expect(screen.queryByRole('button', { name: /oliver/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /oliver/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /luna/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unknown cat/i })).toBeInTheDocument();
  });

  it('renders the map section heading', () => {
    renderWithProviders(<ReportSightingPage />);
    expect(screen.getByRole('heading', { name: /sighting location/i })).toBeInTheDocument();
  });

  it('renders the Additional Details textarea', () => {
    renderWithProviders(<ReportSightingPage />);
    expect(screen.getByPlaceholderText(/where did you see them/i)).toBeInTheDocument();
  });

  it('renders the Submit Sighting button', () => {
    renderWithProviders(<ReportSightingPage />);
    expect(screen.getByRole('button', { name: /submit sighting/i })).toBeInTheDocument();
  });

  it('renders the Safety First guidance card', () => {
    renderWithProviders(<ReportSightingPage />);
    expect(screen.getByText(/safety first/i)).toBeInTheDocument();
  });
});

// ─── Cat selection ────────────────────────────────────────────────────────────

describe('ReportSightingPage — cat selection', () => {
  it('sets aria-pressed to true on the clicked card', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportSightingPage />);

    const card = await screen.findByRole('button', { name: /oliver/i });
    await user.click(card);

    expect(card).toHaveAttribute('aria-pressed', 'true');
  });

  it('deselects the previous card when a new one is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportSightingPage />);

    await user.click(await screen.findByRole('button', { name: /oliver/i }));
    await user.click(screen.getByRole('button', { name: /luna/i }));

    expect(screen.getByRole('button', { name: /oliver/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /luna/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('the Unknown Cat card can be selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportSightingPage />);

    await user.click(await screen.findByRole('button', { name: /unknown cat/i }));

    expect(screen.getByRole('button', { name: /unknown cat/i })).toHaveAttribute('aria-pressed', 'true');
  });
});

// ─── Photo upload ─────────────────────────────────────────────────────────────

describe('ReportSightingPage — photo upload', () => {
  it('shows an image preview after a file is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportSightingPage />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['img'], 'cat.png', { type: 'image/png' }));

    expect(screen.getByRole('img', { name: /preview/i })).toHaveAttribute('src', 'blob:mock-preview-url');
  });

  it('restores the upload prompt after clicking remove', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportSightingPage />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['img'], 'cat.png', { type: 'image/png' }));
    await user.click(screen.getByRole('button', { name: /remove photo/i }));

    expect(screen.getByText(/tap to upload photo/i)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /preview/i })).not.toBeInTheDocument();
  });
});

// ─── Form submit ──────────────────────────────────────────────────────────────

describe('ReportSightingPage — submit', () => {
  it('redirects to /login when not authenticated', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportSightingPage />);

    await user.click(screen.getByRole('button', { name: /submit sighting/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/login', expect.objectContaining({ state: { from: '/report-sighting' } }));
  });

  it('shows a sign-in prompt when unauthenticated', async () => {
    renderWithProviders(<ReportSightingPage />);
    expect(screen.getByText(/you must/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows validation error when no cat is selected (authenticated)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportSightingPage />, { preloadedState: AUTH_STATE });

    await user.click(screen.getByRole('button', { name: /submit sighting/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/select which cat/i);
  });

  it('shows validation error when no map pin is placed (cat selected, authenticated)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportSightingPage />, { preloadedState: AUTH_STATE });

    await user.click(await screen.findByRole('button', { name: /oliver/i }));
    await user.click(screen.getByRole('button', { name: /submit sighting/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/tap the map/i);
  });
});
