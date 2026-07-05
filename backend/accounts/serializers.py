from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import get_user_model
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import SocialAccount
from .services import (
    AccountNotVerifiedError,
    authenticate_account,
    change_unverified_email,
    change_user_password,
    confirm_totp_setup,
    create_token_pair,
    disable_totp,
    email_exists,
    InvalidTOTPCodeError,
    link_sso_account,
    login_or_create_sso_account,
    register_account,
    resend_verification_code,
    SSOAccountConflictError,
    SSOAccountInactiveError,
    start_totp_setup,
    TOTPAlreadyEnabledError,
    TOTPSetupRequiredError,
    verify_user_totp_code,
    verify_email_code,
)
from .sso import SSOProviderError
from .validators import validate_profile_picture_upload


def build_profile_picture_url(user, request=None):
    if not user.profile_picture:
        return None

    try:
        url = user.profile_picture.url
    except ValueError:
        return None

    if request is None:
        return url
    return request.build_absolute_uri(url)


def build_avatar_fallback(user):
    name_parts = [user.first_name.strip(), user.last_name.strip()]
    initials = ''.join(part[0] for part in name_parts if part)
    if initials:
        return initials[:2].upper()

    local_part = user.email.split('@', 1)[0].strip()
    return (local_part[:1] or '?').upper()


class AccountSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    email = serializers.EmailField(read_only=True)


class CurrentUserSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    email = serializers.EmailField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)
    profile_picture_url = serializers.SerializerMethodField()
    avatar_fallback = serializers.SerializerMethodField()

    def get_profile_picture_url(self, user) -> str | None:
        return build_profile_picture_url(
            user,
            request=self.context.get('request'),
        )

    def get_avatar_fallback(self, user) -> str:
        return build_avatar_fallback(user)


class ProfilePictureUploadSerializer(serializers.Serializer):
    profile_picture = serializers.FileField(write_only=True)

    def validate_profile_picture(self, value):
        try:
            validate_profile_picture_upload(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


class AuthResponseSerializer(serializers.Serializer):
    access = serializers.CharField(read_only=True)
    refresh = serializers.CharField(read_only=True)
    token_type = serializers.CharField(read_only=True)
    user = AccountSerializer(read_only=True)


class VerificationPendingResponseSerializer(serializers.Serializer):
    detail = serializers.CharField(read_only=True)
    email_verification_required = serializers.BooleanField(read_only=True)
    resend_available_in_seconds = serializers.IntegerField(read_only=True)
    user = AccountSerializer(read_only=True)


class DetailResponseSerializer(serializers.Serializer):
    detail = serializers.CharField(read_only=True)


class SocialAccountSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(choices=SocialAccount.Provider.choices, read_only=True)
    email = serializers.EmailField(read_only=True)


class SSOLinkResponseSerializer(serializers.Serializer):
    detail = serializers.CharField(read_only=True)
    social_account = SocialAccountSerializer(read_only=True)


def validate_totp_code_value(value):
    code = value.strip()
    if not code.isdigit() or len(code) != settings.TOTP_DIGITS:
        raise serializers.ValidationError(f'Enter the {settings.TOTP_DIGITS}-digit TOTP code.')
    return code


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
    totp_code = serializers.CharField(required=False, write_only=True, trim_whitespace=True)

    def validate(self, attrs):
        try:
            user = authenticate_account(
                request=self.context.get('request'),
                email=attrs['email'],
                password=attrs['password'],
            )
        except AccountNotVerifiedError:
            raise serializers.ValidationError(
                {'email': ['Verify your email before logging in.']}
            )

        if user is None:
            raise serializers.ValidationError(
                {'non_field_errors': ['Unable to log in with provided credentials.']}
            )

        if user.is_totp_enabled:
            totp_code = attrs.get('totp_code')
            if not totp_code:
                raise serializers.ValidationError(
                    {'totp_code': ['TOTP code is required for this account.']}
                )

            try:
                totp_code = validate_totp_code_value(totp_code)
            except serializers.ValidationError as exc:
                raise serializers.ValidationError({'totp_code': exc.detail})

            if not verify_user_totp_code(user=user, code=totp_code):
                raise serializers.ValidationError({'totp_code': ['Enter a valid TOTP code.']})

        attrs['user'] = user
        return attrs


class VerifyEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(
        regex=r'^\d{8}$',
        error_messages={'invalid': 'Enter the 8-digit verification code.'},
    )

    def validate(self, attrs):
        user = verify_email_code(email=attrs['email'], code=attrs['code'])
        if user is None:
            raise serializers.ValidationError(
                {'code': ['The verification code is invalid.']}
            )

        attrs['user'] = user
        return attrs


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def save(self, **kwargs):
        user = resend_verification_code(email=self.validated_data['email'])
        if user is None:
            raise serializers.ValidationError(
                {'email': ['No unverified account exists for this email.']}
            )
        return user


class ChangeVerificationEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_email = serializers.EmailField()

    def validate_new_email(self, value):
        if value.strip().lower() == self.initial_data.get('email', '').strip().lower():
            raise serializers.ValidationError('Enter a different email address.')
        if email_exists(value):
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def save(self, **kwargs):
        try:
            user = change_unverified_email(
                email=self.validated_data['email'],
                password=self.validated_data['password'],
                new_email=self.validated_data['new_email'],
            )
        except ValueError:
            raise serializers.ValidationError(
                {'new_email': ['An account with this email already exists.']}
            )

        if user is None:
            raise serializers.ValidationError(
                {'non_field_errors': ['Unable to change email with provided credentials.']}
            )

        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError(
                {'new_password_confirm': ['Password confirmation does not match.']}
            )
        return attrs


class PasswordResetTOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    totp_code = serializers.CharField(write_only=True, trim_whitespace=True)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_totp_code(self, value):
        return validate_totp_code_value(value)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError(
                {'new_password_confirm': ['Password confirmation does not match.']}
            )
        return attrs


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)
    totp_code = serializers.CharField(
        required=False,
        write_only=True,
        trim_whitespace=True,
    )

    def validate(self, attrs):
        user = self.context['request'].user
        errors = {}

        if not user.check_password(attrs['current_password']):
            errors['current_password'] = ['Current password is incorrect.']

        if attrs['new_password'] != attrs['new_password_confirm']:
            errors['new_password_confirm'] = ['Password confirmation does not match.']

        if user.is_totp_enabled:
            totp_code = attrs.get('totp_code')
            if not totp_code:
                errors['totp_code'] = ['TOTP code is required.']
            else:
                try:
                    totp_code = validate_totp_code_value(totp_code)
                except serializers.ValidationError as exc:
                    errors['totp_code'] = exc.detail
                else:
                    if not verify_user_totp_code(user=user, code=totp_code):
                        errors['totp_code'] = ['Enter a valid TOTP code.']

        try:
            validate_password(attrs['new_password'], user=user)
        except DjangoValidationError as exc:
            errors['new_password'] = list(exc.messages)

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def save(self, **kwargs):
        return change_user_password(
            user=self.context['request'].user,
            new_password=self.validated_data['new_password'],
        )


class TOTPSetupResponseSerializer(serializers.Serializer):
    detail = serializers.CharField(read_only=True)
    secret = serializers.CharField(read_only=True)
    otpauth_url = serializers.CharField(read_only=True)


class TOTPSetupSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.has_usable_password() or not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value

    def save(self, **kwargs):
        try:
            return start_totp_setup(self.context['request'].user)
        except TOTPAlreadyEnabledError:
            raise serializers.ValidationError(
                {'non_field_errors': ['TOTP is already enabled for this account.']}
            )


class TOTPConfirmSerializer(serializers.Serializer):
    totp_code = serializers.CharField(write_only=True, trim_whitespace=True)

    def validate_totp_code(self, value):
        return validate_totp_code_value(value)

    def save(self, **kwargs):
        try:
            return confirm_totp_setup(
                user=self.context['request'].user,
                code=self.validated_data['totp_code'],
            )
        except TOTPSetupRequiredError:
            raise serializers.ValidationError(
                {'non_field_errors': ['Start TOTP setup before confirming a code.']}
            )
        except InvalidTOTPCodeError:
            raise serializers.ValidationError({'totp_code': ['Enter a valid TOTP code.']})


class TOTPDisableSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    totp_code = serializers.CharField(write_only=True, trim_whitespace=True)

    def validate_totp_code(self, value):
        return validate_totp_code_value(value)

    def validate(self, attrs):
        user = self.context['request'].user
        errors = {}

        if not user.is_totp_enabled:
            errors['non_field_errors'] = ['TOTP is not enabled for this account.']

        if not user.has_usable_password() or not user.check_password(attrs['current_password']):
            errors['current_password'] = ['Current password is incorrect.']

        if user.is_totp_enabled and not verify_user_totp_code(user=user, code=attrs['totp_code']):
            errors['totp_code'] = ['Enter a valid TOTP code.']

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def save(self, **kwargs):
        return disable_totp(user=self.context['request'].user)


class SSOLoginSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(choices=SocialAccount.Provider.choices)
    token = serializers.CharField(write_only=True, trim_whitespace=False)

    def save(self, **kwargs):
        try:
            return login_or_create_sso_account(
                provider=self.validated_data['provider'],
                token=self.validated_data['token'],
            )
        except SSOAccountInactiveError as exc:
            raise serializers.ValidationError({'non_field_errors': [str(exc)]})
        except SSOAccountConflictError as exc:
            raise serializers.ValidationError({'email': [str(exc)]})
        except SSOProviderError as exc:
            raise serializers.ValidationError({'token': [str(exc)]})


class SSOLinkSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(choices=SocialAccount.Provider.choices)
    token = serializers.CharField(write_only=True, trim_whitespace=False)
    totp_code = serializers.CharField(required=False, write_only=True, trim_whitespace=True)

    def validate(self, attrs):
        user = self.context['request'].user
        if user.is_totp_enabled:
            totp_code = attrs.get('totp_code')
            if not totp_code:
                raise serializers.ValidationError({'totp_code': ['TOTP code is required.']})

            try:
                totp_code = validate_totp_code_value(totp_code)
            except serializers.ValidationError as exc:
                raise serializers.ValidationError({'totp_code': exc.detail})

            if not verify_user_totp_code(user=user, code=totp_code):
                raise serializers.ValidationError({'totp_code': ['Enter a valid TOTP code.']})

        return attrs

    def save(self, **kwargs):
        try:
            return link_sso_account(
                user=self.context['request'].user,
                provider=self.validated_data['provider'],
                token=self.validated_data['token'],
            )
        except SSOAccountConflictError as exc:
            raise serializers.ValidationError({'provider': [str(exc)]})
        except SSOProviderError as exc:
            raise serializers.ValidationError({'token': [str(exc)]})


def build_verification_pending_response(user):
    return {
        'detail': 'Verification code sent. Verify your email to finish registration.',
        'email_verification_required': True,
        'resend_available_in_seconds': settings.ACCOUNT_VERIFICATION_RESEND_SECONDS,
        'user': AccountSerializer(user).data,
    }


def build_sso_link_response(social_account):
    return {
        'detail': 'SSO provider linked.',
        'social_account': SocialAccountSerializer(social_account).data,
    }


def build_auth_response(user):
    tokens = create_token_pair(user)
    return {
        'access': tokens['access'],
        'refresh': tokens['refresh'],
        'token_type': 'Bearer',
        'user': AccountSerializer(user).data,
    }
