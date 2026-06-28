from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView

from .serializers import (
    AuthResponseSerializer,
    ChangeVerificationEmailSerializer,
    DetailResponseSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    ResendVerificationSerializer,
    SSOLinkResponseSerializer,
    SSOLinkSerializer,
    SSOLoginSerializer,
    VerificationPendingResponseSerializer,
    VerifyEmailSerializer,
    build_auth_response,
    build_sso_link_response,
    build_verification_pending_response,
)
from .services import VerificationCodeCooldownError
from .services import (
    PASSWORD_RESET_INVALID_DETAIL,
    PASSWORD_RESET_REQUEST_DETAIL,
    PASSWORD_RESET_SUCCESS_DETAIL,
    PasswordResetInvalidTokenError,
    request_password_reset,
    reset_password_with_token,
)


def set_no_store_headers(response):
    response['Cache-Control'] = 'no-store'
    response['Pragma'] = 'no-cache'
    return response


def no_store_response(data, *, status_code=status.HTTP_200_OK, headers=None):
    response = Response(data, status=status_code, headers=headers)
    return set_no_store_headers(response)


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth_register'

    @extend_schema(
        request=RegisterSerializer,
        responses={
            201: VerificationPendingResponseSerializer,
            400: OpenApiResponse(description='Validation errors'),
        },
    )
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return no_store_response(
            build_verification_pending_response(user),
            status_code=status.HTTP_201_CREATED,
        )


class VerifyEmailView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth_verify'

    @extend_schema(
        request=VerifyEmailSerializer,
        responses={
            200: AuthResponseSerializer,
            400: OpenApiResponse(description='Invalid verification code or validation errors'),
        },
    )
    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        return no_store_response(build_auth_response(serializer.validated_data['user']))


class ResendVerificationView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth_resend'

    @extend_schema(
        request=ResendVerificationSerializer,
        responses={
            200: VerificationPendingResponseSerializer,
            400: OpenApiResponse(description='Validation errors'),
            429: OpenApiResponse(description='Verification code resend cooldown'),
        },
    )
    def post(self, request):
        serializer = ResendVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = serializer.save()
        except VerificationCodeCooldownError as exc:
            return no_store_response(
                {
                    'resend_available_in_seconds': [exc.seconds_remaining],
                    'detail': ['Wait before requesting another verification code.'],
                },
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                headers={'Retry-After': str(exc.seconds_remaining)},
            )

        return no_store_response(build_verification_pending_response(user))


class ChangeVerificationEmailView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth_change_email'

    @extend_schema(
        request=ChangeVerificationEmailSerializer,
        responses={
            200: VerificationPendingResponseSerializer,
            400: OpenApiResponse(description='Validation errors'),
        },
    )
    def post(self, request):
        serializer = ChangeVerificationEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return no_store_response(build_verification_pending_response(user))


class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth_login'

    @extend_schema(
        request=LoginSerializer,
        responses={
            200: AuthResponseSerializer,
            400: OpenApiResponse(description='Invalid credentials or validation errors'),
        },
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        return no_store_response(build_auth_response(serializer.validated_data['user']))


class SSOLoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth_sso_login'

    @extend_schema(
        request=SSOLoginSerializer,
        responses={
            200: AuthResponseSerializer,
            400: OpenApiResponse(description='Invalid provider token or account conflict'),
        },
    )
    def post(self, request):
        serializer = SSOLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return no_store_response(build_auth_response(user))


class SSOLinkView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth_sso_link'

    @extend_schema(
        request=SSOLinkSerializer,
        responses={
            200: SSOLinkResponseSerializer,
            400: OpenApiResponse(description='Invalid provider token or account conflict'),
            401: OpenApiResponse(description='Authentication required'),
        },
    )
    def post(self, request):
        serializer = SSOLinkSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        social_account = serializer.save()

        return no_store_response(build_sso_link_response(social_account))


class NoStoreTokenRefreshView(TokenRefreshView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth_token_refresh'

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        return set_no_store_headers(response)


class PasswordResetRequestView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(
        request=PasswordResetRequestSerializer,
        responses={
            200: DetailResponseSerializer,
            400: OpenApiResponse(description='Validation errors'),
        },
    )
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request_password_reset(email=serializer.validated_data['email'])

        return no_store_response({'detail': PASSWORD_RESET_REQUEST_DETAIL})


class PasswordResetConfirmView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(
        request=PasswordResetConfirmSerializer,
        responses={
            200: DetailResponseSerializer,
            400: OpenApiResponse(description='Invalid reset link or validation errors'),
        },
    )
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            reset_password_with_token(
                uid=serializer.validated_data['uid'],
                token=serializer.validated_data['token'],
                new_password=serializer.validated_data['new_password'],
            )
        except PasswordResetInvalidTokenError:
            return no_store_response(
                {'detail': PASSWORD_RESET_INVALID_DETAIL},
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        except DjangoValidationError as exc:
            return no_store_response(
                {'new_password': list(exc.messages)},
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        return no_store_response({'detail': PASSWORD_RESET_SUCCESS_DETAIL})
