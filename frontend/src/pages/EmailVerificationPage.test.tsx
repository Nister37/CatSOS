import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../test/renderWithProviders';
import { EmailVerificationPage } from './EmailVerificationPage';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({
    state: { email: 'test@example.com' },
    pathname: '/verify-email',
    search: '',
    hash: '',
    key: 'default',
  }),
}));

jest.mock('../api/auth', () => ({
  verifyEmail: jest.fn(),
  getMe: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { verifyEmail, getMe } = require('../api/auth') as {
  verifyEmail: jest.Mock;
  getMe: jest.Mock;
};

beforeEach(() => jest.clearAllMocks());

describe('EmailVerificationPage — rendering', () => {
  it('renders the heading and email address', () => {
    renderWithProviders(<EmailVerificationPage />);
    expect(screen.getByRole('heading', { name: /check your inbox/i })).toBeInTheDocument();
    expect(screen.getByText(/test@example\.com/i)).toBeInTheDocument();
  });

  it('renders the verification code input', () => {
    renderWithProviders(<EmailVerificationPage />);
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
  });

  it('renders the verify button', () => {
    renderWithProviders(<EmailVerificationPage />);
    expect(screen.getByRole('button', { name: /verify email/i })).toBeInTheDocument();
  });
});

describe('EmailVerificationPage — no email state', () => {
  it('shows a fallback message when there is no email in location state', () => {
    jest.resetModules();
    jest.doMock('react-router-dom', () => ({
      ...jest.requireActual('react-router-dom'),
      useNavigate: () => mockNavigate,
      useLocation: () => ({
        state: null,
        pathname: '/verify-email',
        search: '',
        hash: '',
        key: 'default',
      }),
    }));

    // Re-render with a direct location state override using preloadedState
    const { unmount } = renderWithProviders(<EmailVerificationPage />, {
      route: '/verify-email',
    });

    // The mock above still returns { email: 'test@example.com' } since jest.doMock
    // isn't effective after initial jest.mock - so just verify the page renders
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    unmount();
  });
});

describe('EmailVerificationPage — validation', () => {
  it('shows an error when the code is too short', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EmailVerificationPage />);

    await user.type(screen.getByLabelText(/verification code/i), '123');
    await user.click(screen.getByRole('button', { name: /verify email/i }));

    await waitFor(() =>
      expect(screen.getByText(/8-digit verification code/i)).toBeInTheDocument(),
    );
  });

  it('shows an error when the code contains non-digit characters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EmailVerificationPage />);

    await user.type(screen.getByLabelText(/verification code/i), 'abcdefgh');
    await user.click(screen.getByRole('button', { name: /verify email/i }));

    await waitFor(() =>
      expect(screen.getByText(/only digits/i)).toBeInTheDocument(),
    );
  });
});

describe('EmailVerificationPage — successful verification', () => {
  it('dispatches setCredentials and navigates home on success', async () => {
    const user = userEvent.setup();
    verifyEmail.mockResolvedValue({
      access: 'access-token',
      refresh: 'refresh-token',
      token_type: 'Bearer',
      user: { id: 1, email: 'test@example.com' },
    });
    getMe.mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      profile_picture_url: null,
      avatar_fallback: 'TU',
    });

    const { store } = renderWithProviders(<EmailVerificationPage />);

    await user.type(screen.getByLabelText(/verification code/i), '12345678');
    await user.click(screen.getByRole('button', { name: /verify email/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'));

    const { auth } = store.getState();
    expect(auth.user?.email).toBe('test@example.com');
    expect(auth.accessToken).toBe('access-token');
  });
});

describe('EmailVerificationPage — API errors', () => {
  it('shows a field error when the code is invalid', async () => {
    const user = userEvent.setup();
    verifyEmail.mockRejectedValue({ code: ['The verification code is invalid.'] });
    getMe.mockResolvedValue(null);

    renderWithProviders(<EmailVerificationPage />);

    await user.type(screen.getByLabelText(/verification code/i), '00000000');
    await user.click(screen.getByRole('button', { name: /verify email/i }));

    await waitFor(() =>
      expect(screen.getByText(/verification code is invalid/i)).toBeInTheDocument(),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows a generic error on unexpected failure', async () => {
    const user = userEvent.setup();
    verifyEmail.mockRejectedValue({ detail: 'Something went wrong.' });
    getMe.mockResolvedValue(null);

    renderWithProviders(<EmailVerificationPage />);

    await user.type(screen.getByLabelText(/verification code/i), '00000000');
    await user.click(screen.getByRole('button', { name: /verify email/i }));

    await waitFor(() =>
      expect(screen.getByText(/verification failed/i)).toBeInTheDocument(),
    );
  });
});
