from django.urls import path
from .views import (
    ChangeVerificationEmailView,
    LoginView,
    NoStoreTokenRefreshView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterView,
    ResendVerificationView,
    SSOLinkView,
    SSOLoginView,
    VerifyEmailView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='account-register'),
    path('verify-email/', VerifyEmailView.as_view(), name='account-verify-email'),
    path('verification/resend/', ResendVerificationView.as_view(), name='account-verification-resend'),
    path(
        'verification/change-email/',
        ChangeVerificationEmailView.as_view(),
        name='account-verification-change-email',
    ),
    path('login/', LoginView.as_view(), name='account-login'),
    path('token/', LoginView.as_view(), name='account-token'),
    path('token/refresh/', NoStoreTokenRefreshView.as_view(), name='account-token-refresh'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='account-password-reset'),
    path(
        'password-reset/confirm/',
        PasswordResetConfirmView.as_view(),
        name='account-password-reset-confirm',
    ),
    path('sso/login/', SSOLoginView.as_view(), name='account-sso-login'),
    path('sso/link/', SSOLinkView.as_view(), name='account-sso-link'),
]
