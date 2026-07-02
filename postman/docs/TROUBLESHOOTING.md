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

For Microsoft, add it as a `Web` platform redirect URI in the Entra app registration used for Postman.

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
