import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../test/renderWithProviders';
import { LoginPage } from './LoginPage';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../api/auth', () => ({
  login: jest.fn(),
  getMe: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { login, getMe } = require('../api/auth');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LoginPage — rendering', () => {
  it('renders email and password fields', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders the Log In button', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('renders a link to the signup page', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute('href', '/signup');
  });
});

describe('LoginPage — validation', () => {
  it('shows error for empty email on submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText(/enter a valid email address/i)).toBeInTheDocument();
    });
  });

  it('shows error for invalid email format', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email address/i), 'not-an-email');
    await user.type(screen.getByLabelText(/password/i), 'somepass');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText(/enter a valid email address/i)).toBeInTheDocument();
    });
  });

  it('shows error for empty password', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email address/i), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });
});

describe('LoginPage — API interaction', () => {
  it('calls login API on valid submission', async () => {
    const user = userEvent.setup();
    login.mockResolvedValue({ access: 'token-123', refresh: 'refresh-456' });
    getMe.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      first_name: 'Test',
      last_name: 'User',
      avatar_fallback: 'TU',
    });

    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email address/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'StrongPass123!');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('user@example.com', 'StrongPass123!');
    });
  });

  it('shows server error on failed login', async () => {
    const user = userEvent.setup();
    login.mockRejectedValue({ non_field_errors: ['Invalid credentials.'] });

    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email address/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });
});
