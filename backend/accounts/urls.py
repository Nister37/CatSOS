from django.urls import path
from .views import (
    ChangeVerificationEmailView,
    LoginView,
    NoStoreTokenRefreshView,
    PasswordChangeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    PasswordResetTOTPView,
    RegisterView,
    ResendVerificationView,
    SSOLinkView,
    SSOLoginView,
    TOTPConfirmView,
    TOTPDisableView,
    TOTPSetupView,
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
    path('password-change/', PasswordChangeView.as_view(), name='account-password-change'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='account-password-reset'),
    path(
        'password-reset/confirm/',
        PasswordResetConfirmView.as_view(),
        name='account-password-reset-confirm',
    ),
    path(
        'password-reset/totp/',
        PasswordResetTOTPView.as_view(),
        name='account-password-reset-totp',
    ),
    path('sso/login/', SSOLoginView.as_view(), name='account-sso-login'),
    path('sso/link/', SSOLinkView.as_view(), name='account-sso-link'),
    path('totp/setup/', TOTPSetupView.as_view(), name='account-totp-setup'),
    path('totp/confirm/', TOTPConfirmView.as_view(), name='account-totp-confirm'),
    path('totp/disable/', TOTPDisableView.as_view(), name='account-totp-disable'),
]
