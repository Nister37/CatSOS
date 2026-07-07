import { useEffect, useMemo } from 'react';

/**
 * Handles the Microsoft OAuth redirect callback.
 * Extracts the id_token from the URL fragment and posts it back to the opener window.
 *
 * If Microsoft returns an error (e.g. AADSTS700054), the error is posted back
 * so the parent can display actionable instructions.
 *
 * COOP note: Microsoft login pages set Cross-Origin-Opener-Policy which may
 * null out `window.opener`. In that case we fall back to localStorage signalling
 * so the parent window can still pick up the result.
 */
export function MicrosoftSsoCallbackPage() {
  const { idToken, error, errorDescription } = useMemo(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    return {
      idToken: params.get('id_token'),
      error: params.get('error'),
      errorDescription: params.get('error_description'),
    };
  }, []);

  useEffect(() => {
    if (idToken) {
      const message = { type: 'microsoft-sso-token', token: idToken };
      if (window.opener) {
        window.opener.postMessage(message, window.location.origin);
      } else {
        // COOP broke window.opener — use localStorage as fallback channel
        localStorage.setItem('catsos-sso-result', JSON.stringify(message));
      }
      window.close();
    } else if (error) {
      const detail = errorDescription || error;
      const message = { type: 'microsoft-sso-error', error: detail };
      if (window.opener) {
        window.opener.postMessage(message, window.location.origin);
      } else {
        localStorage.setItem('catsos-sso-result', JSON.stringify(message));
      }
      // Try to close; if it fails (e.g. window wasn't opened by script), the UI below shows
      window.close();
    }
  }, [idToken, error, errorDescription]);

  const detail = errorDescription || error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-on-background">
      <div className="text-center p-lg max-w-md">
        {!detail ? (
          <>
            <span className="material-symbols-outlined text-[48px] text-primary animate-spin">progress_activity</span>
            <p className="mt-md font-body-md text-secondary">Completing sign-in…</p>
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-[48px] text-error">error</span>
            <p className="mt-md font-body-md text-error">Microsoft sign-in failed</p>
            <p className="mt-sm font-body-sm text-secondary break-words">{detail}</p>
            {detail.includes('AADSTS700054') && (
              <div className="mt-md p-sm bg-surface-container rounded-md text-left font-body-sm">
                <p className="font-bold text-on-surface">Azure Portal fix required:</p>
                <ol className="list-decimal ml-md mt-xs text-secondary space-y-xs">
                  <li>Go to Azure Portal → App registrations</li>
                  <li>Select your app → Authentication</li>
                  <li>Under &quot;Implicit grant and hybrid flows&quot;, check <strong>ID tokens</strong></li>
                  <li>Add <code className="text-xs bg-surface-container-high px-1 rounded">http://localhost:5173/sso/microsoft/callback</code> as a SPA redirect URI</li>
                  <li>Save and retry</li>
                </ol>
              </div>
            )}
            <p className="mt-md font-body-sm text-secondary">You may close this window.</p>
          </>
        )}
      </div>
    </div>
  );
}
