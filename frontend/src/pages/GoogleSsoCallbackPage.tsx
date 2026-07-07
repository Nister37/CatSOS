/**
 * Handles the Google OAuth redirect callback.
 * Extracts the id_token from the URL fragment and posts it back to the opener window.
 */
export function GoogleSsoCallbackPage() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const idToken = params.get('id_token');

  if (idToken && window.opener) {
    window.opener.postMessage({ type: 'google-sso-token', token: idToken }, window.location.origin);
    window.close();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-on-background">
      <div className="text-center p-lg">
        <span className="material-symbols-outlined text-[48px] text-primary animate-spin">progress_activity</span>
        <p className="mt-md font-body-md text-secondary">Completing sign-in…</p>
        {!idToken && (
          <p className="mt-sm text-error font-body-sm">
            Sign-in could not be completed. You may close this window.
          </p>
        )}
      </div>
    </div>
  );
}
