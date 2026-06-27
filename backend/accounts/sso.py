from dataclasses import dataclass

import jwt
import requests
from django.conf import settings
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from jwt import PyJWKClient

from .models import SocialAccount


class SSOProviderError(Exception):
    pass


class SSOProviderConfigError(SSOProviderError):
    pass


class SSOIdentityError(SSOProviderError):
    pass


@dataclass(frozen=True)
class SSOIdentity:
    provider: str
    provider_user_id: str
    email: str


def verify_sso_token(*, provider, token):
    if provider == SocialAccount.Provider.GOOGLE:
        return verify_google_id_token(token)
    if provider == SocialAccount.Provider.GITHUB:
        return verify_github_access_token(token)
    if provider == SocialAccount.Provider.MICROSOFT:
        return verify_microsoft_id_token(token)

    raise SSOIdentityError('Unsupported SSO provider.')


def verify_google_id_token(token):
    client_id = settings.GOOGLE_OAUTH_CLIENT_ID
    if not client_id:
        raise SSOProviderConfigError('Google SSO is not configured.')

    try:
        payload = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            client_id,
        )
    except ValueError as exc:
        raise SSOIdentityError('Invalid Google ID token.') from exc

    if payload.get('iss') not in {'accounts.google.com', 'https://accounts.google.com'}:
        raise SSOIdentityError('Invalid Google token issuer.')
    if not payload.get('email_verified'):
        raise SSOIdentityError('Google email is not verified.')

    return build_identity(
        provider=SocialAccount.Provider.GOOGLE,
        provider_user_id=payload.get('sub'),
        email=payload.get('email'),
    )


def verify_github_access_token(token):
    headers = {
        'Accept': 'application/vnd.github+json',
        'Authorization': f'Bearer {token}',
        'X-GitHub-Api-Version': '2022-11-28',
    }

    user_payload = fetch_json('https://api.github.com/user', headers=headers)
    emails_payload = fetch_json('https://api.github.com/user/emails', headers=headers)

    verified_primary_email = next(
        (
            item.get('email')
            for item in emails_payload
            if item.get('primary') and item.get('verified') and item.get('email')
        ),
        None,
    )

    if verified_primary_email is None:
        raise SSOIdentityError('GitHub account has no verified primary email.')

    return build_identity(
        provider=SocialAccount.Provider.GITHUB,
        provider_user_id=str(user_payload.get('id') or ''),
        email=verified_primary_email,
    )


def verify_microsoft_id_token(token):
    client_id = settings.MICROSOFT_OAUTH_CLIENT_ID
    if not client_id:
        raise SSOProviderConfigError('Microsoft SSO is not configured.')

    jwk_client = PyJWKClient(settings.MICROSOFT_JWKS_URL)

    try:
        signing_key = jwk_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=['RS256'],
            audience=client_id,
            options={'require': ['exp', 'iat', 'aud', 'iss', 'sub']},
        )
    except jwt.PyJWTError as exc:
        raise SSOIdentityError('Invalid Microsoft ID token.') from exc

    issuer = payload.get('iss', '')
    if not issuer.startswith('https://login.microsoftonline.com/') or not issuer.endswith('/v2.0'):
        raise SSOIdentityError('Invalid Microsoft token issuer.')

    email = payload.get('email') or payload.get('preferred_username')
    return build_identity(
        provider=SocialAccount.Provider.MICROSOFT,
        provider_user_id=payload.get('sub'),
        email=email,
    )


def fetch_json(url, *, headers):
    try:
        response = requests.get(url, headers=headers, timeout=settings.SSO_HTTP_TIMEOUT_SECONDS)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        raise SSOIdentityError('Unable to verify SSO token with provider.') from exc


def build_identity(*, provider, provider_user_id, email):
    if not provider_user_id:
        raise SSOIdentityError('SSO provider did not return a stable user id.')
    if not email or '@' not in email:
        raise SSOIdentityError('SSO provider did not return a usable email address.')

    return SSOIdentity(
        provider=provider,
        provider_user_id=str(provider_user_id),
        email=email.strip().lower(),
    )
