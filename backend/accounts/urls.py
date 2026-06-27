from django.urls import path
from .views import (
    ChangeVerificationEmailView,
    LoginView,
    NoStoreTokenRefreshView,
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
    path('sso/login/', SSOLoginView.as_view(), name='account-sso-login'),
    path('sso/link/', SSOLinkView.as_view(), name='account-sso-link'),
]
