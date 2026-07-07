import { useEffect, useMemo } from 'react';

/**
 * Handles the Google OAuth redirect callback.
 * Extracts the id_token from the URL fragment and posts it back to the opener window.
 *
 * COOP note: Google login pages set Cross-Origin-Opener-Policy which may
 * null out `window.opener`. In that case we fall back to localStorage signalling
 * so the parent window can still pick up the result.
 */

const SSO_RESULT_KEY = 'catsos-sso-result';

export function GoogleSsoCallbackPage() {
  const { idToken, error, errorDescription } = useMemo(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    // Also check query params (Google sometimes puts errors there instead of fragment)
    const queryParams = new URLSearchParams(window.location.search);
    return {
      idToken: params.get('id_token'),
      error: params.get('error') || queryParams.get('error'),
      errorDescription: params.get('error_description') || queryParams.get('error_description'),
    };
  }, []);

  useEffect(() => {
    if (idToken) {
      const message = { type: 'google-sso-token', token: idToken };
      if (window.opener) {
        window.opener.postMessage(message, window.location.origin);
      }
      // Always write to localStorage as COOP fallback
      localStorage.setItem(SSO_RESULT_KEY, JSON.stringify(message));
      window.close();
    } else if (error) {
      let errorMsg: string;
      if (error === 'redirect_uri_mismatch') {
        errorMsg =
          'redirect_uri_mismatch – Add "' + window.location.origin + '/sso/google/callback" to Authorized Redirect URIs in Google Cloud Console.';
      } else {
        errorMsg = errorDescription || error;
      }
      const message = { type: 'google-sso-error', error: errorMsg };
      if (window.opener) {
        window.opener.postMessage(message, window.location.origin);
      }
      // Always write to localStorage as COOP fallback
      localStorage.setItem(SSO_RESULT_KEY, JSON.stringify(message));
      // Don't auto-close so user can see the configuration instructions
    }
  }, [idToken, error, errorDescription]);

  const isRedirectUriError = error === 'redirect_uri_mismatch';
  const detail = errorDescription || error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-on-background">
      <div className="text-center p-lg max-w-md">
        {!error && !idToken && (
          <>
            <span className="material-symbols-outlined text-[48px] text-primary animate-spin">progress_activity</span>
            <p className="mt-md font-body-md text-secondary">Completing sign-in…</p>
          </>
        )}
        {idToken && (
          <>
            <span className="material-symbols-outlined text-[48px] text-primary animate-spin">progress_activity</span>
            <p className="mt-md font-body-md text-secondary">Completing sign-in…</p>
          </>
        )}
        {error && (
          <div className="flex flex-col items-center">
            <span className="material-symbols-outlined text-[48px] text-error">error</span>
            <p className="mt-md font-body-md text-error">Google sign-in failed</p>
            <p className="mt-sm font-body-sm text-secondary break-words">{detail}</p>

            {isRedirectUriError && (
              <div className="mt-md p-md bg-amber-50 border border-amber-300 rounded-lg text-left w-full">
                <p className="font-bold text-amber-800 text-sm mb-sm">⚠️ Configuration Required</p>
                <p className="text-amber-700 text-xs mb-sm">
                  Go to <strong>Google Cloud Console → APIs &amp; Services → Credentials</strong> and edit your OAuth 2.0 Client ID:
                </p>
                <ul className="list-disc list-inside text-amber-700 text-xs space-y-1">
                  <li>Add <code className="bg-amber-100 px-1 rounded">{window.location.origin}</code> to <strong>Authorized JavaScript Origins</strong></li>
                  <li>Add <code className="bg-amber-100 px-1 rounded">{window.location.origin}/sso/google/callback</code> to <strong>Authorized Redirect URIs</strong></li>
                </ul>
                <p className="text-amber-600 text-xs mt-sm">
                  Changes may take a few minutes to propagate.
                </p>
              </div>
            )}

            {!isRedirectUriError && (
              <div className="mt-md p-md bg-amber-50 border border-amber-300 rounded-lg text-left w-full">
                <p className="text-amber-700 text-xs">
                  If this is a configuration issue, ensure your Google Cloud Console OAuth client has:
                </p>
                <ul className="list-disc list-inside text-amber-700 text-xs mt-sm space-y-1">
                  <li><code className="bg-amber-100 px-1 rounded">{window.location.origin}</code> in Authorized JavaScript Origins</li>
                  <li><code className="bg-amber-100 px-1 rounded">{window.location.origin}/sso/google/callback</code> in Authorized Redirect URIs</li>
                </ul>
              </div>
            )}

            <button
              className="mt-lg px-6 py-2 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700"
              onClick={() => window.close()}
            >
              Close this window
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
