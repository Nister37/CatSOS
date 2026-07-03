# Postman Troubleshooting

Use this when OAuth or SSO login fails in Postman.

## Variables Do Not Resolve In Authorization

Postman variables can be used in Authorization fields with `{{variable_name}}`, but the OAuth popup uses the saved Authorization configuration. Check these before debugging Django:

1. Select `CatSOS Local` in the top-right environment selector.
2. Open the environment and confirm the variable exists there.
3. Save the environment after editing values.
4. Open the OAuth helper request.
5. Hover over each `{{...}}` value in the Authorization tab and confirm Postman shows the resolved value.
6. Open Postman Console.
7. Click `Get New Access Token`.
8. Confirm the generated provider URL contains a non-empty `client_id`.

If Postman Console shows this, the backend is not involved yet:

```text
client_id=
```

Common causes:

- no active environment selected
- environment changes not saved
- duplicate variable names in collection or request scope shadowing the environment value
- stale request tab with an old saved OAuth configuration
- a value stored only as an unsaved request-local value
- a vault or secret reference unavailable to the OAuth popup

## Clean Reimport

If Postman keeps using stale OAuth settings:

1. Delete old duplicate `CatSOS Local API` collections from Postman.
2. Import `postman/CatSOS.postman_collection.json`.
3. Keep the existing `CatSOS Local` environment if it has your secrets.
4. Reopen the helper request from the newly imported collection.
5. Check variable resolution in the Authorization tab before clicking `Get New Access Token`.

Only reimport `postman/CatSOS.local.postman_environment.json` if you want to reset local values.

## `redirect_uri_mismatch`

The provider app registration does not allow Postman's callback URL.

Google and Microsoft Postman helpers both use:

```text
https://oauth.pstmn.io/v1/callback
```

Add that exact URI to the OAuth provider app used by Postman.

For Microsoft, add it as a `Single-page application` platform redirect URI in the Entra app registration used for Postman.

## Microsoft `client does not exist or is not enabled for consumers`

If Microsoft shows:

```text
unauthorized_client: The client does not exist or is not enabled for consumers.
```

the OAuth request is trying to use the consumer Microsoft account authority, but the app registration does not allow personal Microsoft accounts or the client ID does not belong to that audience.

Fix:

1. In Postman, set `microsoft_tenant_id` to `common` for local testing, or to your real tenant ID for a single-tenant app.
2. Keep `Client Secret` empty. If your Postman version has no `None` client-authentication option, keep `Send client credentials in body` selected; do not add a Microsoft client secret.
3. If `microsoft_tenant_id` is already `common`, check which account you selected in the Microsoft login screen. A personal Outlook, Hotmail, Live, Skype, or Xbox account still requires the app registration to support personal Microsoft accounts.
4. Do not use `consumers` unless the Entra app registration's supported account types include personal Microsoft accounts.
5. Confirm `microsoft_oauth_client_id` is the Application (client) ID from the same app registration used in `backend/.env`. Do not use the Object ID, Directory ID, or client secret ID.
6. Save the Postman environment, reopen the Microsoft OAuth helper, and verify the generated authorize URL contains the expected tenant segment.

If the Entra UI does not show `Supported account types`, open the app registration's `Manifest` and check `signInAudience`. For personal Microsoft accounts, it must be `AzureADandPersonalMicrosoftAccount` or `PersonalMicrosoftAccount`.

If `signInAudience` is already correct and Microsoft still shows this error:

1. In the manifest, compare Postman's `client_id` with `appId`, not `id`. The manifest `id` is the Object ID and will fail if used as the OAuth Client ID.
2. In the manifest, set `requestedAccessTokenVersion` to `2`. In older Entra UI/manifest views this may appear as `accessTokenAcceptedVersion`.
3. Confirm you edited the app registration in the same tenant as the Application Client ID copied into Postman.
4. Reopen the Postman OAuth helper and use Postman Console to confirm the generated URL contains the expected `client_id`.
5. In `Authentication (Preview)`, open the `Supported accounts` tab and save the account audience there. If the preview UI looks inconsistent, use the banner link to switch to the old authentication experience and save the same supported-account setting there.
6. If the app registration is set to `Any Entra ID Tenant + Personal Microsoft accounts` and you are testing with a personal Outlook, Hotmail, Live, Skype, or Xbox account, set Postman `microsoft_tenant_id` to `consumers` and retry in a fresh browser session.
7. Confirm the generated URL uses the Microsoft identity platform v2 endpoints:

```text
https://login.microsoftonline.com/common/oauth2/v2.0/authorize
https://login.microsoftonline.com/common/oauth2/v2.0/token
```

If the URL uses `/oauth2/authorize` without `/v2.0/`, update the helper request before trying again.

If you want personal Microsoft accounts to work, update the app registration's supported account types to include personal Microsoft accounts, then retry the OAuth helper. If you want a single-tenant or work/school-only app, sign in with an account from that Entra tenant instead of a personal Microsoft account.

## Microsoft `Tokens issued for the Single-Page Application client-type`

If Postman receives:

```text
AADSTS90023: Tokens issued for the 'Single-Page Application' client-type should only be redeemed via cross-origin requests.
```

or:

```text
AADSTS9002327: Tokens issued for the 'Single-Page Application' client-type may only be redeemed via cross-origin requests.
```

the authorize step worked, but the token exchange failed because the Postman callback is registered as a SPA redirect URI and the token request did not include an `Origin` header.

Fix the Microsoft OAuth helper:

1. Keep `Grant Type` as `Authorization Code (With PKCE)`.
2. Keep `Callback URL` as `https://oauth.pstmn.io/v1/callback`.
3. Keep the Azure redirect URI under `Single-page application`.
4. Open `Advanced` -> `Token Request`.
5. Add a request header:

```text
Origin: https://oauth.pstmn.io
```

Do not include `/v1/callback` in the `Origin` header value.

## Embedded Browser Fails

If Google or Microsoft rejects Postman's embedded login window:

1. Close the provider login window.
2. Open the helper request's `Authorization` tab.
3. Enable `Authorize using browser`.
4. Click `Get New Access Token` again.
5. Complete login in your normal browser.

## Blank Token Field

These errors mean the provider ID token environment variable is empty:

```json
{
  "token": ["This field may not be blank."]
}
```

Fix:

1. Run the matching OAuth helper.
2. Copy `id_token`, not `access_token`.
3. Paste it into `google_id_token` or `microsoft_id_token`.
4. Run the matching CatSOS SSO login request again.

## Invalid Google ID Token

Usually one of these:

- `google_id_token` contains a Google `access_token` instead of an `id_token`
- the token expired
- `backend/.env` has a different `GOOGLE_OAUTH_CLIENT_ID` than Postman
- Django was not restarted after `.env` changed

## Invalid Microsoft ID Token

Usually one of these:

- `microsoft_id_token` contains a Microsoft Graph `access_token` instead of an `id_token`
- the token expired
- `backend/.env` has a different `MICROSOFT_OAUTH_CLIENT_ID` than Postman
- `microsoft_tenant_id` does not match the app registration's supported account type
- Django was not restarted after `.env` changed

For single-tenant Microsoft apps, set `microsoft_tenant_id` to the tenant ID instead of `common`.

## Microsoft `Public clients can't send a client secret`

If Postman receives:

```text
AADSTS90023: Public clients can't send a client secret.
```

the Microsoft helper is using PKCE correctly, but Postman is still sending `client_secret` to the token endpoint.

Fix the helper request:

```text
Grant Type: Authorization Code (With PKCE)
Code Challenge Method: SHA-256
Client Secret: empty
Client Authentication: None, or `Send client credentials in body` if your Postman version has no `None` option
```

For this local Postman SSO helper, do not use `Certificates & secrets`. CatSOS only needs the Microsoft ID token, and the backend validates it against `MICROSOFT_OAUTH_CLIENT_ID`.

## Microsoft `Proof Key for Code Exchange is required`

If Postman redirects back with:

```text
error=invalid_request
Proof Key for Code Exchange is required for cross-origin authorization code redemption.
```

the Microsoft helper is using plain Authorization Code flow. Fix the helper request:

```text
Grant Type: Authorization Code (With PKCE)
Code Challenge Method: SHA-256
```

Then click `Get New Access Token` again. This error happens during Microsoft authorization before CatSOS receives a token.

## Decode An ID Token Locally

This does not verify the signature. It only lets you inspect public JWT claims to compare `aud`, `iss`, and email fields.

Run this only on your machine:

```powershell
$token = "PASTE_ID_TOKEN_HERE"
$payload = $token.Split(".")[1].Replace("-", "+").Replace("_", "/")
switch ($payload.Length % 4) { 2 { $payload += "==" } 3 { $payload += "=" } }
[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload)) |
  ConvertFrom-Json |
  Select-Object iss,aud,email,preferred_username,email_verified,exp
```

Compare:

```text
Google aud    -> backend/.env GOOGLE_OAUTH_CLIENT_ID
Microsoft aud -> backend/.env MICROSOFT_OAUTH_CLIENT_ID
```

They must match exactly.

## Account Conflict

This response is expected when a provider token uses an email that already belongs to a CatSOS password account:

```json
{
  "email": ["An account with this email already exists. Sign in and link this SSO provider."]
}
```

Fix:

1. Log in with the existing CatSOS account.
2. Generate the provider ID token.
3. Run the matching `SSO Link Current Account` request.

## TOTP Required When Linking

If the CatSOS account has authenticator-app TOTP enabled, provider linking requires `totp_code`.

Fill:

```text
totp_code
```

Then rerun the link request.
