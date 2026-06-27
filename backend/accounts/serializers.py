from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .services import (
    authenticate_account,
    create_token_pair,
    email_exists,
    register_account,
)


class AccountSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    email = serializers.EmailField(read_only=True)


class AuthResponseSerializer(serializers.Serializer):
    access = serializers.CharField(read_only=True)
    refresh = serializers.CharField(read_only=True)
    token_type = serializers.CharField(read_only=True)
    user = AccountSerializer(read_only=True)


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_email(self, value):
        if email_exists(value):
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def validate(self, attrs):
        errors = {}

        if attrs['password'] != attrs['password_confirm']:
            errors['password_confirm'] = ['Password confirmation does not match.']

        try:
            user = get_user_model()(email=attrs['email'])
            validate_password(attrs['password'], user=user)
        except DjangoValidationError as exc:
            errors['password'] = list(exc.messages)

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def create(self, validated_data):
        return register_account(
            email=validated_data['email'],
            password=validated_data['password'],
        )


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        user = authenticate_account(
            request=self.context.get('request'),
            email=attrs['email'],
            password=attrs['password'],
        )
        if user is None:
            raise serializers.ValidationError(
                {'non_field_errors': ['Unable to log in with provided credentials.']}
            )

        attrs['user'] = user
        return attrs


def build_auth_response(user):
    tokens = create_token_pair(user)
    return {
        'access': tokens['access'],
        'refresh': tokens['refresh'],
        'token_type': 'Bearer',
        'user': AccountSerializer(user).data,
    }
