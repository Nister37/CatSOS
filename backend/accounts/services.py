import secrets

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from .models import SocialAccount
from .sso import verify_sso_token


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


def normalize_email(email):
    return get_user_model().objects.normalize_email(email).strip().lower()


def email_exists(email):
    normalized_email = normalize_email(email)
    User = get_user_model()
    return User.objects.filter(email__iexact=normalized_email).exists()


def register_account(*, email, password):
    normalized_email = normalize_email(email)
    User = get_user_model()
    user = User.objects.create_user(email=normalized_email, password=password)
    send_verification_code(user)
    return user


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


def generate_verification_code():
    return f'{secrets.randbelow(100_000_000):08d}'


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

    send_mail(
        subject='Your CatSOS verification code',
        message=f'Your CatSOS verification code is {code}.',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
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
