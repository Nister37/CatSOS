import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../test/renderWithProviders';
import { SignupPage } from './SignupPage';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../api/auth', () => ({
  register: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { register } = require('../api/auth');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SignupPage — rendering & interactions', () => {
  it('renders email, password, and confirm password fields', () => {
    renderWithProviders(<SignupPage />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login');
  });

  it('submits registration successfully on valid form', async () => {
    const user = userEvent.setup();
    register.mockResolvedValueOnce({
      id: 42,
      email: 'newuser@example.com',
    });

    const { store } = renderWithProviders(<SignupPage />);

    await user.type(screen.getByLabelText(/email/i), 'newuser@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'SafePassword123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'SafePassword123!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith('newuser@example.com', 'SafePassword123!', 'SafePassword123!');
      expect(mockNavigate).toHaveBeenCalledWith('/verify-email', {
        state: { email: 'newuser@example.com' },
      });
    });

    const notifications = store.getState().notifications.items;
    expect(notifications.some((n) => n.message.includes('Account created'))).toBe(true);
  });

  it('shows server error details on failed registration', async () => {
    const user = userEvent.setup();
    register.mockRejectedValueOnce({
      email: ['A user with that email already exists.'],
    });

    renderWithProviders(<SignupPage />);

    await user.type(screen.getByLabelText(/email/i), 'existing@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'SafePassword123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'SafePassword123!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/a user with that email already exists/i)).toBeInTheDocument();
    });
  });

  it('shows root detail error if backend returns detail', async () => {
    const user = userEvent.setup();
    register.mockRejectedValueOnce({
      detail: 'Registration is temporarily throttled. Please wait.',
    });

    renderWithProviders(<SignupPage />);

    await user.type(screen.getByLabelText(/email/i), 'throttled@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'SafePassword123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'SafePassword123!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/registration is temporarily throttled/i)).toBeInTheDocument();
    });
  });
});
