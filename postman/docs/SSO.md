# CatSOS Postman SSO

This guide covers Google and Microsoft SSO testing through the local Postman collection.

## Mental Model

The OAuth helper requests are only token generators. They call Google or Microsoft through Postman's OAuth UI and let you copy a provider `id_token`.

The CatSOS requests are separate:

```text
20 - Google SSO / Google SSO Login
30 - Microsoft SSO / Microsoft SSO Login
```

Those requests send the provider `id_token` to:

```http
POST {{base_url}}/api/auth/sso/login/
```

CatSOS then returns CatSOS JWTs and the collection stores them in:

```text
access_token
refresh_token
```

Do not paste provider `access_token` values into CatSOS SSO login. Google and Microsoft login both require an `id_token`.

## Environment Variables

The collection refers to these environment variables directly:

| Variable | Used for |
| --- | --- |
| `base_url` | Local Django API base URL |
| `oauth_callback_url` | Postman OAuth callback URL |
| `sso_oidc_scope` | OIDC scope for provider ID tokens |
| `google_oauth_client_id` | Google OAuth Client ID |
| `google_oauth_client_secret` | Google OAuth Client Secret, local Postman only |
| `google_id_token` | Google ID token copied from Postman token details |
| `microsoft_tenant_id` | Microsoft tenant segment, usually `common` for local testing |
| `microsoft_oauth_client_id` | Microsoft Application Client ID |
| `microsoft_oauth_client_secret` | Microsoft client secret, local Postman only |
| `microsoft_id_token` | Microsoft ID token copied from Postman token details |
| `access_token` | CatSOS JWT access token |
| `refresh_token` | CatSOS JWT refresh token |

The backend does not read Postman variables. If a provider client ID changes, update both Postman and `backend/.env`, then restart Django.

## Google Setup

Google Cloud Console must allow this redirect URI for the OAuth client used by Postman:

```text
https://oauth.pstmn.io/v1/callback
```

The same Client ID must be configured in:

```text
backend/.env
GOOGLE_OAUTH_CLIENT_ID=...
```

The Google Client Secret is only needed by Postman to generate a test token. Do not put it in `backend/.env`.

## Google Test Flow

1. Select the `CatSOS Local` Postman environment.
2. Set `google_oauth_client_id`.
3. Set `google_oauth_client_secret`.
4. Run `00 - Setup & Smoke / Health Check`.
5. Open `20 - Google SSO / Google OAuth Helper (Get ID Token)`.
6. Open the `Authorization` tab.
7. Confirm the fields resolve from variables:

```text
Callback URL: {{oauth_callback_url}}
Auth URL: https://accounts.google.com/o/oauth2/v2/auth
Access Token URL: https://oauth2.googleapis.com/token
Client ID: {{google_oauth_client_id}}
Client Secret: {{google_oauth_client_secret}}
Scope: {{sso_oidc_scope}}
Client Authentication: Send client credentials in body
```

8. Click `Get New Access Token`.
9. Sign in with Google.
10. Copy `id_token` from the returned token details.
11. Paste it into `google_id_token`.
12. Run `20 - Google SSO / Google SSO Login`.

## Microsoft Setup

In Microsoft Entra admin center:

1. Open `Identity` -> `Applications` -> `App registrations`.
2. Open the CatSOS app registration.
3. Keep the frontend redirect URI if it already exists:

```text
http://localhost:5173/auth/callback/microsoft
```

4. Add a separate Postman redirect URI under `Authentication` -> `Add a platform` -> `Web`:

```text
https://oauth.pstmn.io/v1/callback
```

5. Create a client secret under `Certificates & secrets`.
6. Copy the secret value into Postman variable `microsoft_oauth_client_secret`.

Configure the backend with the same Application Client ID:

```text
backend/.env
MICROSOFT_OAUTH_CLIENT_ID=...
MICROSOFT_JWKS_URL=https://login.microsoftonline.com/common/discovery/v2.0/keys
```

Then restart Django if `.env` changed.

For `microsoft_tenant_id`, use:

```text
common        accepts accounts allowed by the app registration
organizations work or school accounts only
consumers     personal Microsoft accounts only
tenant ID     single-tenant app registrations
```

The local default is `common`.

## Microsoft Test Flow

1. Select the `CatSOS Local` Postman environment.
2. Set `microsoft_oauth_client_id` to the same value as `MICROSOFT_OAUTH_CLIENT_ID`.
3. Set `microsoft_oauth_client_secret`.
4. Leave `microsoft_tenant_id` as `common`, unless the app registration is single-tenant.
5. Run `00 - Setup & Smoke / Health Check`.
6. Open `30 - Microsoft SSO / Microsoft OAuth Helper (Get ID Token)`.
7. Open the `Authorization` tab.
8. Confirm the fields resolve from variables:

```text
Grant Type: Authorization Code
Callback URL: {{oauth_callback_url}}
Auth URL: https://login.microsoftonline.com/{{microsoft_tenant_id}}/oauth2/v2.0/authorize
Access Token URL: https://login.microsoftonline.com/{{microsoft_tenant_id}}/oauth2/v2.0/token
Client ID: {{microsoft_oauth_client_id}}
Client Secret: {{microsoft_oauth_client_secret}}
Scope: {{sso_oidc_scope}}
Client Authentication: Send client credentials in body
```

9. Click `Get New Access Token`.
10. Sign in with Microsoft.
11. Copy `id_token` from the returned token details.
12. Paste it into `microsoft_id_token`.
13. Run `30 - Microsoft SSO / Microsoft SSO Login`.

Expected CatSOS response:

```json
{
  "access": "...",
  "refresh": "...",
  "token_type": "Bearer",
  "user": {
    "id": 1,
    "email": "user@example.com"
  }
}
```

## Linking Providers

To test provider linking:

1. Log in to CatSOS first with password or SSO so `access_token` is set.
2. Generate the provider `id_token`.
3. Paste it into `google_id_token` or `microsoft_id_token`.
4. Run the matching `SSO Link Current Account` request.

If the CatSOS account has TOTP enabled, fill `totp_code` before linking.

## References

- [Microsoft identity platform authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
- [Microsoft identity platform OpenID Connect](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc)
- [Microsoft identity platform scopes and permissions](https://learn.microsoft.com/en-us/entra/identity-platform/scopes-oidc)
