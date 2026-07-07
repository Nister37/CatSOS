import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ssoLogin, getMe } from '../api/auth';
import { setCredentials, setAccessToken } from '../features/auth/authSlice';
import { addNotification } from '../features/notifications/notificationsSlice';
import { useAppDispatch } from '../app/hooks';

/**
 * Hook that provides Google SSO and Microsoft SSO login handlers.
 *
 * Google: Uses the Google Identity Services (GSI) library loaded in index.html.
 *         Triggers One Tap / popup flow → receives an ID token → POSTs to backend.
 *
 * Microsoft: Uses the OAuth 2.0 implicit/auth-code flow via redirect. Opens a popup
 *            to the Microsoft authorization endpoint, then listens for the ID token
 *            fragment response.
 */
export function useSsoLogin() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [ssoLoading, setSsoLoading] = useState<'google' | 'microsoft' | null>(null);

  const handleSsoSuccess = useCallback(
    async (provider: 'google' | 'microsoft', token: string) => {
      try {
        const authRes = await ssoLogin(provider, token);
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
        dispatch(addNotification('Welcome!', 'success'));
        navigate('/');
      } catch (err: unknown) {
        const apiError = err as Record<string, string | string[]>;
        const detail =
          typeof apiError?.detail === 'string'
            ? apiError.detail
            : Array.isArray(apiError?.non_field_errors)
              ? apiError.non_field_errors[0]
              : `${provider === 'google' ? 'Google' : 'Microsoft'} sign-in failed. Please try again.`;
        dispatch(addNotification(detail, 'error'));
      } finally {
        setSsoLoading(null);
      }
    },
    [dispatch, navigate],
  );

  const loginWithGoogle = useCallback(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      dispatch(addNotification('Google SSO is not configured. Set VITE_GOOGLE_CLIENT_ID.', 'error'));
      return;
    }

    if (typeof google === 'undefined' || !google.accounts?.id) {
      dispatch(addNotification('Google Sign-In is still loading. Please try again in a moment.', 'error'));
      return;
    }

    setSsoLoading('google');

    google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response.credential) {
          handleSsoSuccess('google', response.credential);
        } else {
          setSsoLoading(null);
          dispatch(addNotification('Google sign-in was cancelled.', 'error'));
        }
      },
      cancel_on_tap_outside: true,
    });

    google.accounts.id.prompt((notification) => {
      // If One Tap is not displayed (e.g. user dismissed it before, or browser blocks it),
      // fall back to a manual popup using the older OAuth approach via a new window.
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        openGooglePopup(clientId);
      }
    });
  }, [dispatch, handleSsoSuccess]);

  const openGooglePopup = useCallback(
    (clientId: string) => {
      // Fallback: open a consent popup using Google's OAuth 2.0 endpoint to get an id_token.
      const redirectUri = `${window.location.origin}/sso/google/callback`;
      const scope = 'openid email profile';
      const url =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=id_token` +
        `&scope=${encodeURIComponent(scope)}` +
        `&nonce=${crypto.randomUUID()}` +
        `&prompt=select_account`;

      const popup = window.open(url, 'google-sso', 'width=500,height=600,left=200,top=100');
      if (!popup) {
        setSsoLoading(null);
        dispatch(addNotification('Pop-up blocked. Please allow pop-ups for this site.', 'error'));
        return;
      }

      // Listen for the callback page to post the token back
      const listener = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'google-sso-token' && event.data?.token) {
          window.removeEventListener('message', listener);
          handleSsoSuccess('google', event.data.token);
        }
      };
      window.addEventListener('message', listener);

      // Clean up if user closes the popup without completing
      const check = setInterval(() => {
        if (popup.closed) {
          clearInterval(check);
          window.removeEventListener('message', listener);
          setSsoLoading(null);
        }
      }, 500);
    },
    [dispatch, handleSsoSuccess],
  );

  const loginWithMicrosoft = useCallback(() => {
    const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
    if (!clientId) {
      dispatch(addNotification('Microsoft SSO is not configured. Set VITE_MICROSOFT_CLIENT_ID.', 'error'));
      return;
    }

    setSsoLoading('microsoft');

    const tenantId = import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common';
    const redirectUri = `${window.location.origin}/sso/microsoft/callback`;
    const scope = 'openid email profile';
    const nonce = crypto.randomUUID();

    const url =
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=id_token` +
      `&scope=${encodeURIComponent(scope)}` +
      `&response_mode=fragment` +
      `&nonce=${encodeURIComponent(nonce)}` +
      `&prompt=select_account`;

    const popup = window.open(url, 'microsoft-sso', 'width=500,height=700,left=200,top=100');
    if (!popup) {
      setSsoLoading(null);
      dispatch(addNotification('Pop-up blocked. Please allow pop-ups for this site.', 'error'));
      return;
    }

    // Listen for the callback page to post the token back
    const listener = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'microsoft-sso-token' && event.data?.token) {
        window.removeEventListener('message', listener);
        handleSsoSuccess('microsoft', event.data.token);
      }
    };
    window.addEventListener('message', listener);

    // Clean up if user closes the popup without completing
    const check = setInterval(() => {
      if (popup.closed) {
        clearInterval(check);
        window.removeEventListener('message', listener);
        setSsoLoading(null);
      }
    }, 500);
  }, [dispatch, handleSsoSuccess]);

  return { loginWithGoogle, loginWithMicrosoft, ssoLoading };
}
