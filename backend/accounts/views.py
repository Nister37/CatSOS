from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    AuthResponseSerializer,
    ChangeVerificationEmailSerializer,
    LoginSerializer,
    RegisterSerializer,
    ResendVerificationSerializer,
    VerificationPendingResponseSerializer,
    VerifyEmailSerializer,
    build_auth_response,
    build_verification_pending_response,
)


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

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

        return Response(build_verification_pending_response(user), status=status.HTTP_201_CREATED)


class VerifyEmailView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

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

        return Response(build_auth_response(serializer.validated_data['user']))


class ResendVerificationView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(
        request=ResendVerificationSerializer,
        responses={
            200: VerificationPendingResponseSerializer,
            400: OpenApiResponse(description='Validation errors or resend cooldown'),
        },
    )
    def post(self, request):
        serializer = ResendVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response(build_verification_pending_response(user))


class ChangeVerificationEmailView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

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

        return Response(build_verification_pending_response(user))


class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

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

        return Response(build_auth_response(serializer.validated_data['user']))
