import { screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import { SettingsPage } from './SettingsPage';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../api/auth', () => ({
  updateProfile: jest.fn(),
  deleteAccount: jest.fn().mockResolvedValue(undefined),
  uploadProfilePicture: jest.fn(),
  deleteProfilePicture: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { deleteAccount, uploadProfilePicture, deleteProfilePicture } = require('../api/auth');

describe('SettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders settings tab with danger zone', async () => {
    renderWithProviders(<SettingsPage />, {
      preloadedState: {
        auth: {
          user: {
            id: 1,
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            avatarFallback: 'JD',
          },
          accessToken: 'mock-token',
          refreshToken: 'mock-refresh',
        },
      },
    });

    // Switch to settings tab
    const settingsTab = screen.getByRole('tab', { name: /settings/i });
    await userEvent.click(settingsTab);

    expect(screen.getByText('Danger Zone')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument();
  });

  it('opens confirmation modal when Delete Account is clicked', async () => {
    renderWithProviders(<SettingsPage />, {
      preloadedState: {
        auth: {
          user: {
            id: 1,
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            avatarFallback: 'JD',
          },
          accessToken: 'mock-token',
          refreshToken: 'mock-refresh',
        },
      },
    });

    // Switch to settings tab
    await userEvent.click(screen.getByRole('tab', { name: /settings/i }));

    // Click delete account
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));

    // Modal should be open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hold to delete account/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change my mind/i })).toBeInTheDocument();
  });

  it('handles uploading a valid profile picture', async () => {
    uploadProfilePicture.mockResolvedValueOnce({
      profile_picture_url: 'https://example.com/new-pic.jpg',
      avatar_fallback: 'JD',
    });

    renderWithProviders(<SettingsPage />, {
      preloadedState: {
        auth: {
          user: {
            id: 1,
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            avatarFallback: 'JD',
          },
          accessToken: 'mock-token',
          refreshToken: 'mock-refresh',
        },
      },
    });

    await userEvent.click(screen.getByRole('tab', { name: /settings/i }));

    const file = new File(['dummy-image'], 'photo.png', { type: 'image/png' });
    const input = screen.getByLabelText(/upload profile picture/i);
    await userEvent.upload(input, file);

    expect(uploadProfilePicture).toHaveBeenCalledWith(file);
  });

  it('rejects an oversized profile picture', async () => {
    renderWithProviders(<SettingsPage />, {
      preloadedState: {
        auth: {
          user: {
            id: 1,
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            avatarFallback: 'JD',
          },
          accessToken: 'mock-token',
          refreshToken: 'mock-refresh',
        },
      },
    });

    await userEvent.click(screen.getByRole('tab', { name: /settings/i }));

    // Create 6MB file
    const oversizedFile = new File([new Uint8Array(6 * 1024 * 1024)], 'large.png', {
      type: 'image/png',
    });
    const input = screen.getByLabelText(/upload profile picture/i);
    await userEvent.upload(input, oversizedFile);

    expect(screen.getByText(/image must be under 5mb/i)).toBeInTheDocument();
    expect(uploadProfilePicture).not.toHaveBeenCalled();
  });

  it('handles deleting profile picture', async () => {
    deleteProfilePicture.mockResolvedValueOnce({
      profile_picture_url: null,
      avatar_fallback: 'JD',
    });

    renderWithProviders(<SettingsPage />, {
      preloadedState: {
        auth: {
          user: {
            id: 1,
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            avatarFallback: 'JD',
            profilePictureUrl: 'https://example.com/old-pic.jpg',
          },
          accessToken: 'mock-token',
          refreshToken: 'mock-refresh',
        },
      },
    });

    await userEvent.click(screen.getByRole('tab', { name: /settings/i }));

    const removeBtn = screen.getByRole('button', { name: /remove/i });
    expect(removeBtn).toBeInTheDocument();
    await userEvent.click(removeBtn);

    expect(deleteProfilePicture).toHaveBeenCalledTimes(1);
  });
});

