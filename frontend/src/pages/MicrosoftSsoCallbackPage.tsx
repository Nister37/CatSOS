import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { runtimeEnv } from '../config/runtimeEnv';

const SSO_RESULT_KEY = 'catsos-sso-result';
const redeemedCodes = new Set<string>();

function sendResult(data: { type: string; token?: string; error?: string }) {
  if (window.opener) {
    window.opener.postMessage(data, window.location.origin);
  }
  // Don't overwrite an already successful token with a late error
  const existing = localStorage.getItem(SSO_RESULT_KEY);
  if (existing && data.type === 'microsoft-sso-error') {
    try {
      const parsed = JSON.parse(existing);
      if (parsed.type === 'microsoft-sso-token' && parsed.token) {
        return;
      }
    } catch {
      // ignore
    }
  }
  localStorage.setItem(SSO_RESULT_KEY, JSON.stringify(data));
}

export function MicrosoftSsoCallbackPage() {
  const callback = useMemo(() => {
    const query = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.substring(1));
    const get = (name: string) => query.get(name) ?? fragment.get(name);
    const oauthError = get('error');

    return {
      code: get('code'),
      idToken: get('id_token'),
      error: oauthError ? get('error_description') || oauthError : null,
    };
  }, []);
  const [status, setStatus] = useState(
    callback.idToken
      ? 'Sign-in successful! This window will close.'
      : callback.code
        ? 'Exchanging authorization code...'
        : 'Processing Microsoft sign-in...',
  );
  const [error, setError] = useState<string | null>(
    callback.error ??
      (!callback.code && !callback.idToken
        ? 'No authorization code or token received from Microsoft.'
        : null),
  );

  const exchangeStartedRef = useRef(false);

  const exchangeCodeForToken = useCallback(async (code: string) => {
    await Promise.resolve();
    const clientId = runtimeEnv.VITE_MICROSOFT_CLIENT_ID;
    const tenantId = runtimeEnv.VITE_MICROSOFT_TENANT_ID || 'common';
    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    const codeVerifier =
      sessionStorage.getItem('catsos-ms-code-verifier') ||
      localStorage.getItem('catsos-ms-code-verifier') ||
      '';

    if (!clientId) {
      const message = 'Microsoft sign-in is not configured. Missing client id.';
      setError(message);
      sendResult({ type: 'microsoft-sso-error', error: message });
      return;
    }

    if (!codeVerifier) {
      const message = 'Missing PKCE code verifier. Please try signing in again.';
      setError(message);
      sendResult({ type: 'microsoft-sso-error', error: message });
      return;
    }

    try {
      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      const body = new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
        scope: 'openid email profile',
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let message =
          errorData.error_description || errorData.error || 'Token exchange failed.';
        if (
          message.includes('AADSTS70000') ||
          message.includes('expired') ||
          message.includes('not valid')
        ) {
          message =
            'Your Microsoft sign-in code has expired or was already used. Please close this window and try signing in again.';
        }
        setError(message);
        sendResult({ type: 'microsoft-sso-error', error: message });
        return;
      }

      const data = await response.json();
      const idToken = data.id_token;
      if (!idToken) {
        const message = 'No id_token received.';
        setError('No id_token in token response.');
        sendResult({ type: 'microsoft-sso-error', error: message });
        return;
      }

      sessionStorage.removeItem('catsos-ms-code-verifier');
      try {
        localStorage.removeItem('catsos-ms-code-verifier');
      } catch {
        // ignore
      }
      sendResult({ type: 'microsoft-sso-token', token: idToken });
      setStatus('Sign-in successful! This window will close.');
      window.setTimeout(() => window.close(), 500);
    } catch (caughtError) {
      const message = `Token exchange error: ${caughtError instanceof Error ? caughtError.message : 'Unknown error'}`;
      setError(message);
      sendResult({ type: 'microsoft-sso-error', error: message });
    }
  }, []);

  useEffect(() => {
    if (callback.error) {
      sendResult({ type: 'microsoft-sso-error', error: callback.error });
      return;
    }
    if (callback.code) {
      if (exchangeStartedRef.current || redeemedCodes.has(callback.code)) {
        return;
      }
      exchangeStartedRef.current = true;
      redeemedCodes.add(callback.code);
      void exchangeCodeForToken(callback.code);
      return;
    }
    if (callback.idToken) {
      sendResult({ type: 'microsoft-sso-token', token: callback.idToken });
      const closeTimer = window.setTimeout(() => window.close(), 500);
      return () => window.clearTimeout(closeTimer);
    }
    sendResult({ type: 'microsoft-sso-error', error: 'No code or token received.' });
  }, [callback, exchangeCodeForToken]);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', textAlign: 'center' }}>
      {error ? (
        <div>
          <h2 style={{ color: '#b52330' }}>Microsoft SSO Error</h2>
          <p style={{ maxWidth: 500, margin: '1rem auto', color: '#333' }}>{error}</p>
          <button
            onClick={() => window.close()}
            style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', cursor: 'pointer' }}
          >
            Close this window
          </button>
        </div>
      ) : (
        <div>
          <p>{status}</p>
          <div style={{ marginTop: '1rem' }}>
            <div
              style={{
                width: 24,
                height: 24,
                border: '3px solid #0078d4',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto',
              }}
            />
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
