from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils.translation import gettext_lazy as _


PROFILE_PICTURE_UPLOAD_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}


def profile_picture_upload_path(instance, filename):
    extension = Path(filename).suffix.lower()
    if extension not in PROFILE_PICTURE_UPLOAD_EXTENSIONS:
        extension = '.jpg'

    user_segment = instance.pk or 'new'
    return f'profile-pictures/user-{user_segment}/{uuid4().hex}{extension}'


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _normalize_email(self, email):
        return self.normalize_email(email).strip().lower()

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The email address must be set.')

        email = self._normalize_email(email)
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        extra_fields.setdefault('is_email_verified', False)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_email_verified', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    username = None
    email = models.EmailField(_('email address'), unique=True)
    profile_picture = models.ImageField(upload_to=profile_picture_upload_path, blank=True)
    is_email_verified = models.BooleanField(default=False)
    email_verification_code_hash = models.CharField(max_length=128, blank=True)
    email_verification_sent_at = models.DateTimeField(blank=True, null=True)
    email_verified_at = models.DateTimeField(blank=True, null=True)
    totp_secret = models.CharField(max_length=64, blank=True)
    is_totp_enabled = models.BooleanField(default=False)
    totp_enabled_at = models.DateTimeField(blank=True, null=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email


class SocialAccount(models.Model):
    class Provider(models.TextChoices):
        GOOGLE = 'google', 'Google'
        GITHUB = 'github', 'GitHub'
        MICROSOFT = 'microsoft', 'Microsoft'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='social_accounts',
    )
    provider = models.CharField(max_length=20, choices=Provider.choices)
    provider_user_id = models.CharField(max_length=255)
    email = models.EmailField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['provider', 'provider_user_id'],
                name='unique_social_provider_user',
            ),
        ]
        indexes = [
            models.Index(fields=['provider', 'email']),
        ]

    def __str__(self):
        return f'{self.provider}:{self.email}'
