# CatSOS Postman Guide

Use this only for local API testing.

## Import

Import these canonical JSON files into Postman:

```text
postman/CatSOS.postman_collection.json
postman/CatSOS.local.postman_environment.json
```

Then select the `CatSOS Local` environment in the top-right dropdown.

The imported collection is grouped by flow:

```text
00 - Setup & Smoke
10 - Email & Password Auth
20 - Google SSO
30 - Microsoft SSO
```

Do not import duplicate local workspace folders from `postman/collections/` unless you are intentionally restoring a Postman desktop workspace. The JSON files above are the clean import path.

## Smoke Test

Run:

```http
GET {{base_url}}/api/health/
```

Expected response:

```json
{
  "status": "ok",
  "service": "catsos-backend"
}
```

## Email And Password Login

Use these requests in order:

1. `10 - Email & Password Auth / Register`
2. Copy the verification code from the Django console email output.
3. Put it in the `verification_code` environment variable.
4. Run `10 - Email & Password Auth / Verify Email`.

The collection stores `access_token` and `refresh_token` automatically after successful verification, password login, SSO login, and token refresh.

For an existing verified user, run:

```text
10 - Email & Password Auth / Login With Password
```

## SSO

CatSOS SSO login expects provider identity tokens for Google and Microsoft:

```text
Google:    google_id_token
Microsoft: microsoft_id_token
```

Do not send Google or Microsoft access tokens to CatSOS SSO login. The backend verifies the provider `id_token`, then returns CatSOS JWTs.

Provider setup and testing steps live in:

- [SSO.md](docs/SSO.md)
- [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

## Reimport Safely

If you already have local secrets or tokens in Postman, reimport only:

```text
postman/CatSOS.postman_collection.json
```

Do not reimport the environment unless you want to reset local values.

If the environment is reset, refill the provider client secrets, regenerate provider ID tokens, and log in again.

## Security Note

OAuth client IDs are not secrets. OAuth client secrets, provider ID tokens, CatSOS access tokens, and CatSOS refresh tokens are secrets.

Do not commit real client secrets or tokens.
