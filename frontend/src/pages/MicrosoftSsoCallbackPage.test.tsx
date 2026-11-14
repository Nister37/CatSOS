import { screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../test/renderWithProviders';
import { MicrosoftSsoCallbackPage } from './MicrosoftSsoCallbackPage';

jest.mock('../config/runtimeEnv', () => ({
  runtimeEnv: {
    VITE_MICROSOFT_CLIENT_ID: 'mock-client-id',
    VITE_MICROSOFT_TENANT_ID: 'common',
  },
}));

describe('MicrosoftSsoCallbackPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/auth/callback/microsoft');
    jest.clearAllMocks();
  });

  it('publishes the message type expected by the SSO listener', async () => {
    window.history.replaceState({}, '', '/auth/callback/microsoft#id_token=test-token');

    renderWithProviders(<MicrosoftSsoCallbackPage />);

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem('catsos-sso-result') ?? '{}')).toEqual({
        type: 'microsoft-sso-token',
        token: 'test-token',
      });
    });
  });

  it('displays user-friendly error when code has expired or AADSTS70000 occurs', async () => {
    window.history.replaceState({}, '', '/auth/callback/microsoft?error=invalid_grant&error_description=AADSTS70000:+The+provided+value+for+the+code+parameter+is+not+valid.+The+code+has+expired.');

    renderWithProviders(<MicrosoftSsoCallbackPage />);

    await waitFor(() => {
      expect(screen.getByText('Microsoft SSO Error')).toBeInTheDocument();
      expect(screen.getByText(/AADSTS70000/i)).toBeInTheDocument();
    });
  });

  it('exchanges code for token using code verifier and posts id token', async () => {
    window.history.replaceState({}, '', '/auth/callback/microsoft?code=valid-code');
    window.sessionStorage.setItem('catsos-ms-code-verifier', 'mock-verifier');

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id_token: 'returned-id-token' }),
    });

    renderWithProviders(<MicrosoftSsoCallbackPage />);

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem('catsos-sso-result') ?? '{}')).toEqual({
        type: 'microsoft-sso-token',
        token: 'returned-id-token',
      });
    });
  });
});
