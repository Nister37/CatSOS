import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ssoLogin, getMe } from '../api/auth';
import { setCredentials, setAccessToken } from '../features/auth/authSlice';
import { addNotification } from '../features/notifications/notificationsSlice';
import { useAppDispatch } from '../app/hooks';

/**
 * SSO timeout in milliseconds. If neither postMessage nor localStorage
 * delivers a result within this time, we assume the user closed the popup.
 */
const SSO_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * localStorage key used as a fallback communication channel when
 * Cross-Origin-Opener-Policy (COOP) headers from identity providers
 * null out `window.opener` in the popup.
 */
const SSO_RESULT_KEY = 'catsos-sso-result';

/**
 * Hook that provides Google SSO and Microsoft SSO login handlers.
 *
 * Google: Uses the Google Identity Services (GSI) library loaded in index.html.
 *         Triggers One Tap / popup flow → receives an ID token → POSTs to backend.
 *
 * Microsoft: Uses the OAuth 2.0 implicit flow via popup. Opens a popup
 *            to the Microsoft authorization endpoint, then listens for the ID token
 *            via postMessage or localStorage fallback.
 *
 * COOP handling: Identity providers (Microsoft, Google) set Cross-Origin-Opener-Policy
 * headers which break the traditional `popup.closed` polling pattern. Instead we:
 * 1. Listen for postMessage from the callback page (works when COOP doesn't interfere)
 * 2. Poll localStorage for a result set by the callback page (COOP fallback)
 * 3. Use a timeout to eventually clean up if neither mechanism fires
 */
export function useSsoLogin() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [ssoLoading, setSsoLoading] = useState<'google' | 'microsoft' | null>(null);
  const [ssoError, setSsoError] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Clean up any pending SSO listener on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

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

  /**
   * Sets up a COOP-safe listener for SSO popup results.
   * Uses postMessage as primary channel and localStorage polling as fallback.
   */
  const listenForPopupResult = useCallback(
    (provider: 'google' | 'microsoft') => {
      const tokenType = `${provider}-sso-token`;
      const errorType = `${provider}-sso-error`;

      // Clear any previous result in localStorage
      localStorage.removeItem(SSO_RESULT_KEY);

      let settled = false;

      const settle = () => {
        if (settled) return;
        settled = true;
        window.removeEventListener('message', messageListener);
        clearInterval(storagePoller);
        clearTimeout(timeout);
        cleanupRef.current = null;
      };

      const handleToken = (token: string) => {
        settle();
        handleSsoSuccess(provider, token);
      };

      const handleError = (error: string) => {
        settle();
        setSsoLoading(null);

        let userMessage: string;
        if (error.includes('AADSTS700054')) {
          userMessage =
            'Microsoft SSO requires enabling ID tokens in Azure Portal: ' +
            'App registrations → Authentication → Implicit grant → Check "ID tokens". ' +
            'Also add http://localhost:5173/sso/microsoft/callback as a SPA redirect URI.';
        } else if (error.includes('redirect_uri_mismatch')) {
          userMessage =
            'Google OAuth error: redirect_uri_mismatch.\n\n' +
            'Fix in Google Cloud Console → APIs & Services → Credentials → Your OAuth Client:\n' +
            `• Add "${window.location.origin}/sso/google/callback" to Authorized Redirect URIs`;
        } else if (error.includes('origin') && error.includes('not allowed')) {
          userMessage =
            'Google OAuth error: origin not allowed for this client ID.\n\n' +
            'Fix in Google Cloud Console → APIs & Services → Credentials → Your OAuth Client:\n' +
            `• Add "${window.location.origin}" to Authorized JavaScript Origins\n` +
            `• Add "${window.location.origin}/sso/google/callback" to Authorized Redirect URIs`;
        } else {
          userMessage = `${provider === 'google' ? 'Google' : 'Microsoft'} sign-in failed: ${error}`;
        }

        setSsoError(userMessage);
        dispatch(addNotification(userMessage, 'error'));
      };

      const handleTimeout = () => {
        if (settled) return;
        settle();
        setSsoLoading(null);
        // Don't show error — user likely just closed the popup
      };

      // Primary: postMessage from callback page
      const messageListener = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === tokenType && event.data?.token) {
          handleToken(event.data.token);
        } else if (event.data?.type === errorType && event.data?.error) {
          handleError(event.data.error);
        }
      };
      window.addEventListener('message', messageListener);

      // Fallback: poll localStorage for result (handles COOP case where
      // window.opener is null and postMessage cannot reach us)
      const storagePoller = setInterval(() => {
        const raw = localStorage.getItem(SSO_RESULT_KEY);
        if (!raw) return;
        localStorage.removeItem(SSO_RESULT_KEY);
        try {
          const data = JSON.parse(raw);
          if (data.type === tokenType && data.token) {
            handleToken(data.token);
          } else if (data.type === errorType && data.error) {
            handleError(data.error);
          }
        } catch {
          // Corrupt localStorage entry — ignore
        }
      }, 500);

      // Safety timeout — clean up if nothing happens
      const timeout = setTimeout(handleTimeout, SSO_TIMEOUT_MS);

      // Store cleanup function for unmount
      cleanupRef.current = () => {
        settle();
        setSsoLoading(null);
      };
    },
    [dispatch, handleSsoSuccess],
  );

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
        const msg = 'Pop-up blocked. Please allow pop-ups for this site.';
        setSsoError(msg);
        dispatch(addNotification(msg, 'error'));
        return;
      }

      listenForPopupResult('google');
    },
    [dispatch, listenForPopupResult],
  );

  const loginWithGoogle = useCallback(() => {
    setSsoError(null);
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      const msg = 'Google SSO is not configured. Set VITE_GOOGLE_CLIENT_ID in frontend/.env. See .env.example for details.';
      setSsoError(msg);
      dispatch(addNotification(msg, 'error'));
      return;
    }

    setSsoLoading('google');

    // If the GSI library is not loaded, skip straight to the popup redirect flow.
    if (typeof google === 'undefined' || !google.accounts?.id) {
      console.warn('[CatSOS] Google GSI library not available, using redirect popup flow.');
      openGooglePopup(clientId);
      return;
    }

    try {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) {
            handleSsoSuccess('google', response.credential);
          } else {
            // One Tap was cancelled – fall back to popup redirect flow.
            openGooglePopup(clientId);
          }
        },
        cancel_on_tap_outside: true,
      });

      google.accounts.id.prompt((notification) => {
        // If One Tap is not displayed (e.g. origin not allowed, user dismissed, browser blocks),
        // fall back to a popup using the standard OAuth 2.0 authorize endpoint.
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          const reason = notification.getNotDisplayedReason?.() ?? '';
          if (reason) {
            console.warn('[CatSOS] Google One Tap not displayed:', reason);
          }
          openGooglePopup(clientId);
        }
      });
    } catch (err) {
      // GSI initialization can throw if origin is not allowed for the client ID.
      console.error('[CatSOS] Google One Tap init error:', err);
      openGooglePopup(clientId);
    }
  }, [dispatch, handleSsoSuccess, openGooglePopup]);

  const loginWithMicrosoft = useCallback(() => {
    setSsoError(null);
    const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
    if (!clientId) {
      const msg = 'Microsoft SSO is not configured. Set VITE_MICROSOFT_CLIENT_ID in frontend/.env. See .env.example for details.';
      setSsoError(msg);
      dispatch(addNotification(msg, 'error'));
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

    listenForPopupResult('microsoft');
  }, [dispatch, listenForPopupResult]);

  return { loginWithGoogle, loginWithMicrosoft, ssoLoading, ssoError, clearSsoError: () => setSsoError(null) };
}
