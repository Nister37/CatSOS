import base64
import hashlib
import hmac
import logging
import secrets
import struct
import time
from smtplib import SMTPException
from urllib.parse import quote, urlencode

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.core.files.storage import default_storage
from django.core.mail import BadHeaderError
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework_simplejwt.tokens import RefreshToken

from .email_templates import render_account_email
from .languages import DEFAULT_PREFERRED_LANGUAGE, normalize_preferred_language
from .models import SocialAccount
from .sso import verify_sso_token


PASSWORD_RESET_REQUEST_DETAIL = (
    'If an account exists for this email, password reset instructions were sent.'
)
PASSWORD_RESET_SUCCESS_DETAIL = 'Password has been reset successfully.'
PASSWORD_RESET_INVALID_DETAIL = 'Invalid or expired reset link.'
PASSWORD_RESET_TOTP_INVALID_DETAIL = 'Invalid email or TOTP code.'
PASSWORD_RESET_RATE_LIMIT_DETAIL = 'Too many password reset requests. Try again later.'
PASSWORD_CHANGE_SUCCESS_DETAIL = 'Password has been changed successfully.'
EMAIL_DELIVERY_UNAVAILABLE_DETAIL = 'Email delivery is temporarily unavailable. Try again later.'
TOTP_ENABLED_DETAIL = 'Authenticator app verification has been enabled.'
TOTP_DISABLED_DETAIL = 'Authenticator app verification has been disabled.'

logger = logging.getLogger(__name__)


def replace_profile_picture(*, user, image):
    old_picture_name = user.profile_picture.name
    user.profile_picture = image
    user.save(update_fields=['profile_picture'])

    if old_picture_name and old_picture_name != user.profile_picture.name:
        default_storage.delete(old_picture_name)

    return user


def delete_profile_picture(*, user):
    old_picture_name = user.profile_picture.name
    if not old_picture_name:
        return user

    user.profile_picture = ''
    user.save(update_fields=['profile_picture'])
    default_storage.delete(old_picture_name)
    return user


class AccountNotVerifiedError(Exception):
    pass


class SSOAccountConflictError(Exception):
    pass


class SSOAccountInactiveError(Exception):
    pass


class VerificationCodeCooldownError(Exception):
    def __init__(self, seconds_remaining):
        self.seconds_remaining = seconds_remaining
        super().__init__('Verification code resend is still on cooldown.')


class PasswordResetInvalidTokenError(Exception):
    pass


class PasswordResetRateLimitError(Exception):
    pass


class InvalidTOTPCodeError(Exception):
    pass


class TOTPAlreadyEnabledError(Exception):
    pass


class TOTPSetupRequiredError(Exception):
    pass


class EmailDeliveryError(Exception):
    pass


def normalize_email(email):
    return get_user_model().objects.normalize_email(email).strip().lower()


def email_exists(email):
    normalized_email = normalize_email(email)
    User = get_user_model()
    return User.objects.filter(email__iexact=normalized_email).exists()


@transaction.atomic
def register_account(*, email, password, preferred_language=DEFAULT_PREFERRED_LANGUAGE):
    normalized_email = normalize_email(email)
    User = get_user_model()
    user = User.objects.create_user(
        email=normalized_email,
        password=password,
        preferred_language=normalize_preferred_language(preferred_language),
    )
    send_verification_code(user)
    return user


def _send_account_email(*, purpose, subject, message, recipient_list, raise_on_error=True):
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipient_list,
            fail_silently=False,
        )
    except (BadHeaderError, OSError, SMTPException) as exc:
        logger.warning(
            'Account email delivery failed.',
            extra={
                'email_purpose': purpose,
                'recipient_count': len(recipient_list),
                'error_type': exc.__class__.__name__,
            },
            exc_info=True,
        )
        if raise_on_error:
            raise EmailDeliveryError from exc
        return False

    return True


def authenticate_account(*, request, email, password):
    normalized_email = normalize_email(email)
    user = authenticate(request=request, email=normalized_email, password=password)
    if user is None or not user.is_active:
        return None
    if not user.is_email_verified:
        raise AccountNotVerifiedError
    return user


def create_token_pair(user):
    refresh = RefreshToken.for_user(user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    }


def _password_reset_rate_limit_key(*, kind, value):
    digest = hashlib.sha256(value.encode('utf-8')).hexdigest()
    return f'accounts:password-reset:{kind}:{digest}'


def _increment_cache_counter(key, timeout):
    if cache.add(key, 1, timeout=timeout):
        return 1

    try:
        return cache.incr(key)
    except (ValueError, NotImplementedError):
        current = cache.get(key, 0) + 1
        cache.set(key, current, timeout=timeout)
        return current


def check_password_reset_rate_limit(*, email, request_ip=None):
    window_seconds = 60 * 60
    checks = [
        (
            _password_reset_rate_limit_key(kind='email', value=normalize_email(email)),
            settings.PASSWORD_RESET_EMAIL_RATE_LIMIT_PER_HOUR,
        ),
    ]

    if request_ip:
        checks.append(
            (
                _password_reset_rate_limit_key(kind='ip', value=request_ip),
                settings.PASSWORD_RESET_IP_RATE_LIMIT_PER_HOUR,
            )
        )

    is_limited = False
    for key, limit in checks:
        if limit <= 0:
            continue
        count = _increment_cache_counter(key, timeout=window_seconds)
        if count > limit:
            is_limited = True

    if is_limited:
        raise PasswordResetRateLimitError


def generate_totp_secret():
    return base64.b32encode(secrets.token_bytes(20)).decode('ascii').rstrip('=')


def _decode_totp_secret(secret):
    normalized_secret = ''.join(secret.split()).upper()
    padding = '=' * ((8 - len(normalized_secret) % 8) % 8)
    return base64.b32decode(f'{normalized_secret}{padding}', casefold=True)


def _hotp(secret, counter):
    key = _decode_totp_secret(secret)
    counter_bytes = struct.pack('>Q', counter)
    digest = hmac.new(key, counter_bytes, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code_int = struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return f'{code_int % (10 ** settings.TOTP_DIGITS):0{settings.TOTP_DIGITS}d}'


def verify_totp_code(*, secret, code, at_time=None):
    if not secret or not code:
        return False

    current_time = int(at_time or time.time())
    counter = current_time // settings.TOTP_STEP_SECONDS
    normalized_code = str(code).strip()

    for offset in range(-settings.TOTP_WINDOW, settings.TOTP_WINDOW + 1):
        expected_code = _hotp(secret, counter + offset)
        if hmac.compare_digest(expected_code, normalized_code):
            return True

    return False


def verify_user_totp_code(*, user, code):
    if not user.is_totp_enabled or not user.totp_secret:
        return False
    return verify_totp_code(secret=user.totp_secret, code=code)


def build_totp_otpauth_url(user):
    label = quote(f'{settings.TOTP_ISSUER_NAME}:{user.email}')
    query = urlencode(
        {
            'secret': user.totp_secret,
            'issuer': settings.TOTP_ISSUER_NAME,
            'algorithm': 'SHA1',
            'digits': settings.TOTP_DIGITS,
            'period': settings.TOTP_STEP_SECONDS,
        }
    )
    return f'otpauth://totp/{label}?{query}'


def start_totp_setup(user):
    if user.is_totp_enabled:
        raise TOTPAlreadyEnabledError

    user.totp_secret = generate_totp_secret()
    user.totp_enabled_at = None
    user.save(update_fields=['totp_secret', 'totp_enabled_at'])
    return {
        'secret': user.totp_secret,
        'otpauth_url': build_totp_otpauth_url(user),
    }


def confirm_totp_setup(*, user, code):
    if not user.totp_secret or user.is_totp_enabled:
        raise TOTPSetupRequiredError

    if not verify_totp_code(secret=user.totp_secret, code=code):
        raise InvalidTOTPCodeError

    user.is_totp_enabled = True
    user.totp_enabled_at = timezone.now()
    user.save(update_fields=['is_totp_enabled', 'totp_enabled_at'])
    return user


def disable_totp(*, user):
    user.totp_secret = ''
    user.is_totp_enabled = False
    user.totp_enabled_at = None
    user.save(update_fields=['totp_secret', 'is_totp_enabled', 'totp_enabled_at'])
    return user


def request_password_reset(*, email, request_ip=None):
    check_password_reset_rate_limit(email=email, request_ip=request_ip)
    normalized_email = normalize_email(email)
    User = get_user_model()
    user = User.objects.filter(
        email__iexact=normalized_email,
        is_active=True,
    ).first()

    if user is None or not user.has_usable_password():
        return None

    send_password_reset_link(user)
    return user


def build_password_reset_link(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f'{settings.FRONTEND_URL}/password-reset/confirm/?uid={uid}&token={token}'


def send_password_reset_link(user):
    reset_link = build_password_reset_link(user)
    subject, message = render_account_email(
        'password_reset_link',
        user=user,
        reset_link=reset_link,
    )
    return _send_account_email(
        purpose='password_reset_link',
        subject=subject,
        message=message,
        recipient_list=[user.email],
    )


def send_password_reset_confirmation(user):
    subject, message = render_account_email(
        'password_reset_confirmation',
        user=user,
    )
    return _send_account_email(
        purpose='password_reset_confirmation',
        subject=subject,
        message=message,
        recipient_list=[user.email],
        raise_on_error=False,
    )


def send_password_change_confirmation(user):
    subject, message = render_account_email(
        'password_change_confirmation',
        user=user,
    )
    return _send_account_email(
        purpose='password_change_confirmation',
        subject=subject,
        message=message,
        recipient_list=[user.email],
        raise_on_error=False,
    )


def get_password_reset_user(*, uid, token):
    User = get_user_model()
    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id, is_active=True)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return None

    if not user.has_usable_password():
        return None

    if not default_token_generator.check_token(user, token):
        return None

    return user


def reset_password_with_token(*, uid, token, new_password):
    user = get_password_reset_user(uid=uid, token=token)
    if user is None:
        raise PasswordResetInvalidTokenError

    validate_password(new_password, user=user)
    user.set_password(new_password)
    user.save(update_fields=['password'])
    send_password_reset_confirmation(user)
    return user


def reset_password_with_totp(*, email, code, new_password, request_ip=None):
    check_password_reset_rate_limit(email=email, request_ip=request_ip)
    normalized_email = normalize_email(email)
    User = get_user_model()
    user = User.objects.filter(
        email__iexact=normalized_email,
        is_active=True,
        is_totp_enabled=True,
    ).first()

    if user is None or not user.has_usable_password() or not verify_user_totp_code(user=user, code=code):
        raise InvalidTOTPCodeError

    validate_password(new_password, user=user)
    user.set_password(new_password)
    user.save(update_fields=['password'])
    send_password_reset_confirmation(user)
    return user


def change_user_password(*, user, new_password):
    user.set_password(new_password)
    user.save(update_fields=['password'])
    send_password_change_confirmation(user)
    return user


def generate_verification_code():
    return f'{secrets.randbelow(100_000_000):08d}'


@transaction.atomic
def send_verification_code(user):
    code = generate_verification_code()
    user.email_verification_code_hash = make_password(code)
    user.email_verification_sent_at = timezone.now()
    user.email_verified_at = None
    user.is_email_verified = False
    user.save(
        update_fields=[
            'email_verification_code_hash',
            'email_verification_sent_at',
            'email_verified_at',
            'is_email_verified',
        ]
    )

    subject, message = render_account_email(
        'verification_code',
        user=user,
        code=code,
    )
    _send_account_email(
        purpose='verification_code',
        subject=subject,
        message=message,
        recipient_list=[user.email],
        raise_on_error=False,
    )
    return user


def get_unverified_user_by_email(email):
    normalized_email = normalize_email(email)
    User = get_user_model()
    try:
        return User.objects.get(email__iexact=normalized_email, is_email_verified=False)
    except User.DoesNotExist:
        return None


def seconds_until_resend_available(user):
    if user.email_verification_sent_at is None:
        return 0

    elapsed = timezone.now() - user.email_verification_sent_at
    seconds_remaining = settings.ACCOUNT_VERIFICATION_RESEND_SECONDS - int(elapsed.total_seconds())
    return max(seconds_remaining, 0)


@transaction.atomic
def resend_verification_code(*, email):
    user = get_unverified_user_by_email(email)
    if user is None:
        return None

    seconds_remaining = seconds_until_resend_available(user)
    if seconds_remaining > 0:
        raise VerificationCodeCooldownError(seconds_remaining)

    return send_verification_code(user)


def verify_email_code(*, email, code):
    user = get_unverified_user_by_email(email)
    if user is None:
        return None

    if not user.email_verification_code_hash:
        return None

    if not check_password(code, user.email_verification_code_hash):
        return None

    user.is_email_verified = True
    user.email_verified_at = timezone.now()
    user.email_verification_code_hash = ''
    user.save(
        update_fields=[
            'is_email_verified',
            'email_verified_at',
            'email_verification_code_hash',
        ]
    )
    return user


@transaction.atomic
def change_unverified_email(*, email, password, new_email):
    user = get_unverified_user_by_email(email)
    if user is None or not user.check_password(password):
        return None

    normalized_new_email = normalize_email(new_email)
    User = get_user_model()
    if User.objects.filter(email__iexact=normalized_new_email).exclude(pk=user.pk).exists():
        raise ValueError('email_exists')

    user.email = normalized_new_email
    user.save(update_fields=['email'])
    return send_verification_code(user)


@transaction.atomic
def login_or_create_sso_account(*, provider, token):
    identity = verify_sso_token(provider=provider, token=token)
    existing_social_account = SocialAccount.objects.select_related('user').filter(
        provider=identity.provider,
        provider_user_id=identity.provider_user_id,
    ).first()

    if existing_social_account is not None:
        if not existing_social_account.user.is_active:
            raise SSOAccountInactiveError('This account is inactive.')
        if existing_social_account.email != identity.email:
            existing_social_account.email = identity.email
            existing_social_account.save(update_fields=['email', 'updated_at'])
        return existing_social_account.user

    User = get_user_model()
    if User.objects.filter(email__iexact=identity.email).exists():
        raise SSOAccountConflictError(
            'An account with this email already exists. Sign in and link this SSO provider.'
        )

    user = User.objects.create_user(
        email=identity.email,
        password=None,
        is_email_verified=True,
        email_verified_at=timezone.now(),
    )
    SocialAccount.objects.create(
        user=user,
        provider=identity.provider,
        provider_user_id=identity.provider_user_id,
        email=identity.email,
    )
    return user


@transaction.atomic
def link_sso_account(*, user, provider, token):
    identity = verify_sso_token(provider=provider, token=token)
    existing_social_account = SocialAccount.objects.select_related('user').filter(
        provider=identity.provider,
        provider_user_id=identity.provider_user_id,
    ).first()

    if existing_social_account is not None:
        if existing_social_account.user_id == user.id:
            if existing_social_account.email != identity.email:
                existing_social_account.email = identity.email
                existing_social_account.save(update_fields=['email', 'updated_at'])
            return existing_social_account
        raise SSOAccountConflictError('This SSO provider account is already linked to another user.')

    User = get_user_model()
    if User.objects.filter(email__iexact=identity.email).exclude(pk=user.pk).exists():
        raise SSOAccountConflictError('This SSO email belongs to another CatSOS account.')

    social_account = SocialAccount.objects.create(
        user=user,
        provider=identity.provider,
        provider_user_id=identity.provider_user_id,
        email=identity.email,
    )

    if not user.is_email_verified and normalize_email(user.email) == identity.email:
        user.is_email_verified = True
        user.email_verified_at = timezone.now()
        user.email_verification_code_hash = ''
        user.save(
            update_fields=[
                'is_email_verified',
                'email_verified_at',
                'email_verification_code_hash',
            ]
        )

    return social_account
