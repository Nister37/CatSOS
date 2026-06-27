from django.contrib.auth import authenticate, get_user_model
from rest_framework_simplejwt.tokens import RefreshToken


def normalize_email(email):
    return get_user_model().objects.normalize_email(email).strip().lower()


def email_exists(email):
    normalized_email = normalize_email(email)
    User = get_user_model()
    return User.objects.filter(email__iexact=normalized_email).exists()


def register_account(*, email, password):
    normalized_email = normalize_email(email)
    User = get_user_model()
    return User.objects.create_user(email=normalized_email, password=password)


def authenticate_account(*, request, email, password):
    normalized_email = normalize_email(email)
    user = authenticate(request=request, email=normalized_email, password=password)
    if user is None or not user.is_active:
        return None
    return user


def create_token_pair(user):
    refresh = RefreshToken.for_user(user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    }
