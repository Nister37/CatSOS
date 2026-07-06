from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView

from .serializers import (
    AuthResponseSerializer,
    ChangeVerificationEmailSerializer,
    CurrentUserSerializer,
    DetailResponseSerializer,
    LoginSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    PasswordResetTOTPSerializer,
    ProfilePictureUploadSerializer,
    PublicProfileSerializer,
    RegisterSerializer,
    ResendVerificationSerializer,
    SSOLinkResponseSerializer,
    SSOLinkSerializer,
    SSOLoginSerializer,
    TOTPConfirmSerializer,
    TOTPDisableSerializer,
    TOTPSetupResponseSerializer,
    TOTPSetupSerializer,
    VerificationPendingResponseSerializer,
    VerifyEmailSerializer,
    build_auth_response,
    build_sso_link_response,
    build_verification_pending_response,
    user_has_public_activity,
)
from .services import VerificationCodeCooldownError
from .services import (
    PASSWORD_CHANGE_SUCCESS_DETAIL,
    PASSWORD_RESET_INVALID_DETAIL,
    PASSWORD_RESET_RATE_LIMIT_DETAIL,
    PASSWORD_RESET_REQUEST_DETAIL,
    PASSWORD_RESET_SUCCESS_DETAIL,
    PASSWORD_RESET_TOTP_INVALID_DETAIL,
    TOTP_DISABLED_DETAIL,
    TOTP_ENABLED_DETAIL,
    InvalidTOTPCodeError,
    PasswordResetInvalidTokenError,
    PasswordResetRateLimitError,
    delete_profile_picture,
    request_password_reset,
    replace_profile_picture,
    reset_password_with_totp,
    reset_password_with_token,
)


def set_no_store_headers(response):
    response['Cache-Control'] = 'no-store'
    response['Pragma'] = 'no-cache'
    return response


def no_store_response(data, *, status_code=status.HTTP_200_OK, headers=None):
    response = Response(data, status=status_code, headers=headers)
    return set_no_store_headers(response)


def get_client_ip(request):
    return request.META.get('REMOTE_ADDR', '')


class NoStoreAPIView(APIView):
    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        return set_no_store_headers(response)


class CurrentUserView(NoStoreAPIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={
            200: CurrentUserSerializer,
            401: OpenApiResponse(description='Authentication required'),
        },
    )
    def get(self, request):
        serializer = CurrentUserSerializer(request.user, context={'request': request})
        return no_store_response(serializer.data)


class PublicProfileView(NoStoreAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'public_profile'

    @extend_schema(
        responses={
            200: PublicProfileSerializer,
            404: OpenApiResponse(description='Public profile not found'),
            429: OpenApiResponse(description='Public profile rate limit exceeded'),
        },
    )
    def get(self, request, pk):
        User = get_user_model()
        try:
            user = User.objects.get(
                pk=pk,
                is_active=True,
                is_email_verified=True,
            )
        except User.DoesNotExist:
            raise Http404

        if not user_has_public_activity(user):
            raise Http404

        serializer = PublicProfileSerializer(user, context={'request': request})
        return no_store_response(serializer.data)


class ProfilePictureView(NoStoreAPIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def _serialize_user(self, request):
        serializer = CurrentUserSerializer(request.user, context={'request': request})
        return serializer.data

    def _upload(self, request):
        serializer = ProfilePictureUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        replace_profile_picture(
            user=request.user,
            image=serializer.validated_data['profile_picture'],
        )
        return no_store_response(self._serialize_user(request))

    @extend_schema(
        request=ProfilePictureUploadSerializer,
        responses={
            200: CurrentUserSerializer,
            400: OpenApiResponse(description='Validation errors'),
            401: OpenApiResponse(description='Authentication required'),
        },
    )
    def post(self, request):
        return self._upload(request)

    @extend_schema(
        request=ProfilePictureUploadSerializer,
        responses={
            200: CurrentUserSerializer,
            400: OpenApiResponse(description='Validation errors'),
            401: OpenApiResponse(description='Authentication required'),
        },
    )
    def put(self, request):
        return self._upload(request)

    @extend_schema(
        request=ProfilePictureUploadSerializer,
        responses={
            200: CurrentUserSerializer,
            400: OpenApiResponse(description='Validation errors'),
            401: OpenApiResponse(description='Authentication required'),
        },
    )
    def patch(self, request):
        return self._upload(request)

    @extend_schema(
        request=None,
        responses={
            200: CurrentUserSerializer,
            401: OpenApiResponse(description='Authentication required'),
        },
    )
    def delete(self, request):
        delete_profile_picture(user=request.user)
        return no_store_response(self._serialize_user(request))


class RegisterView(NoStoreAPIView):
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


class VerifyEmailView(NoStoreAPIView):
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


class ResendVerificationView(NoStoreAPIView):
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


class ChangeVerificationEmailView(NoStoreAPIView):
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


class LoginView(NoStoreAPIView):
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


class SSOLoginView(NoStoreAPIView):
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


class SSOLinkView(NoStoreAPIView):
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


class PasswordResetRequestView(NoStoreAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(
        request=PasswordResetRequestSerializer,
        responses={
            200: DetailResponseSerializer,
            400: OpenApiResponse(description='Validation errors'),
            429: OpenApiResponse(description='Password reset request rate limit exceeded'),
        },
    )
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            request_password_reset(
                email=serializer.validated_data['email'],
                request_ip=get_client_ip(request),
            )
        except PasswordResetRateLimitError:
            return no_store_response(
                {'detail': PASSWORD_RESET_RATE_LIMIT_DETAIL},
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                headers={'Retry-After': str(60 * 60)},
            )

        return no_store_response({'detail': PASSWORD_RESET_REQUEST_DETAIL})


class PasswordResetConfirmView(NoStoreAPIView):
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


class PasswordResetTOTPView(NoStoreAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(
        request=PasswordResetTOTPSerializer,
        responses={
            200: DetailResponseSerializer,
            400: OpenApiResponse(description='Invalid TOTP code or validation errors'),
            429: OpenApiResponse(description='Password reset request rate limit exceeded'),
        },
    )
    def post(self, request):
        serializer = PasswordResetTOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            reset_password_with_totp(
                email=serializer.validated_data['email'],
                code=serializer.validated_data['totp_code'],
                new_password=serializer.validated_data['new_password'],
                request_ip=get_client_ip(request),
            )
        except PasswordResetRateLimitError:
            return no_store_response(
                {'detail': PASSWORD_RESET_RATE_LIMIT_DETAIL},
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                headers={'Retry-After': str(60 * 60)},
            )
        except InvalidTOTPCodeError:
            return no_store_response(
                {'detail': PASSWORD_RESET_TOTP_INVALID_DETAIL},
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        except DjangoValidationError as exc:
            return no_store_response(
                {'new_password': list(exc.messages)},
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        return no_store_response({'detail': PASSWORD_RESET_SUCCESS_DETAIL})


class PasswordChangeView(NoStoreAPIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=PasswordChangeSerializer,
        responses={
            200: DetailResponseSerializer,
            400: OpenApiResponse(description='Validation errors'),
            401: OpenApiResponse(description='Authentication required'),
        },
    )
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return no_store_response({'detail': PASSWORD_CHANGE_SUCCESS_DETAIL})


class TOTPSetupView(NoStoreAPIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=TOTPSetupSerializer,
        responses={
            200: TOTPSetupResponseSerializer,
            400: OpenApiResponse(description='Validation errors'),
            401: OpenApiResponse(description='Authentication required'),
        },
    )
    def post(self, request):
        serializer = TOTPSetupSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        setup_data = serializer.save()

        return no_store_response(
            {
                'detail': 'Scan this secret with an authenticator app, then confirm a code.',
                **setup_data,
            }
        )


class TOTPConfirmView(NoStoreAPIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=TOTPConfirmSerializer,
        responses={
            200: DetailResponseSerializer,
            400: OpenApiResponse(description='Validation errors'),
            401: OpenApiResponse(description='Authentication required'),
        },
    )
    def post(self, request):
        serializer = TOTPConfirmSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return no_store_response({'detail': TOTP_ENABLED_DETAIL})


class TOTPDisableView(NoStoreAPIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=TOTPDisableSerializer,
        responses={
            200: DetailResponseSerializer,
            400: OpenApiResponse(description='Validation errors'),
            401: OpenApiResponse(description='Authentication required'),
        },
    )
    def post(self, request):
        serializer = TOTPDisableSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return no_store_response({'detail': TOTP_DISABLED_DETAIL})
