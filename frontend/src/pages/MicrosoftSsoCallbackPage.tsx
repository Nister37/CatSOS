import { useEffect, useState } from 'react';

const SSO_RESULT_KEY = 'catsos-sso-result';

function sendResult(data: { type: string; token?: string; error?: string }) {
  // Primary: postMessage to opener
  if (window.opener) {
    window.opener.postMessage(data, window.location.origin);
  }
  // Fallback: localStorage for COOP case
  localStorage.setItem(SSO_RESULT_KEY, JSON.stringify(data));
}

export function MicrosoftSsoCallbackPage() {
  const [status, setStatus] = useState('Processing Microsoft sign-in...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fragment = window.location.hash.substring(1);
    const params = new URLSearchParams(fragment);

    // Check for errors first
    const oauthError = params.get('error');
    const errorDesc = params.get('error_description');
    if (oauthError) {
      const msg = errorDesc || oauthError;
      setError(msg);
      sendResult({ type: 'microsoft-error', error: msg });
      return;
    }

    // Authorization Code flow: exchange code for tokens
    const code = params.get('code');
    if (code) {
      exchangeCodeForToken(code);
      return;
    }

    // Legacy: implicit flow id_token
    const idToken = params.get('id_token');
    if (idToken) {
      sendResult({ type: 'microsoft-token', token: idToken });
      setStatus('Sign-in successful! This window will close.');
      setTimeout(() => window.close(), 500);
      return;
    }

    setError('No authorization code or token received from Microsoft.');
    sendResult({ type: 'microsoft-error', error: 'No code or token received.' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function exchangeCodeForToken(code: string) {
    const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
    const tenantId = import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common';
    const redirectUri = `${window.location.origin}/auth/callback/microsoft`;
    const codeVerifier = sessionStorage.getItem('catsos-ms-code-verifier') || '';

    if (!codeVerifier) {
      const msg = 'Missing PKCE code verifier. Please try signing in again.';
      setError(msg);
      sendResult({ type: 'microsoft-error', error: msg });
      return;
    }

    try {
      setStatus('Exchanging authorization code...');
      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      const body = new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
        scope: 'openid email profile',
      });

      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': window.location.origin },
        body: body.toString(),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.error_description || errData.error || 'Token exchange failed.';
        setError(msg);
        sendResult({ type: 'microsoft-error', error: msg });
        return;
      }

      const data = await res.json();
      const idToken = data.id_token;
      if (!idToken) {
        setError('No id_token in token response.');
        sendResult({ type: 'microsoft-error', error: 'No id_token received.' });
        return;
      }

      sessionStorage.removeItem('catsos-ms-code-verifier');
      sendResult({ type: 'microsoft-token', token: idToken });
      setStatus('Sign-in successful! This window will close.');
      setTimeout(() => window.close(), 500);
    } catch (err) {
      const msg = `Token exchange error: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setError(msg);
      sendResult({ type: 'microsoft-error', error: msg });
    }
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', textAlign: 'center' }}>
      {error ? (
        <div>
          <h2 style={{ color: '#b52330' }}>Microsoft SSO Error</h2>
          <p style={{ maxWidth: 500, margin: '1rem auto', color: '#333' }}>{error}</p>
          <button onClick={() => window.close()} style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', cursor: 'pointer' }}>
            Close this window
          </button>
        </div>
      ) : (
        <div>
          <p>{status}</p>
          <div style={{ marginTop: '1rem' }}>
            <div style={{ width: 24, height: 24, border: '3px solid #0078d4', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
