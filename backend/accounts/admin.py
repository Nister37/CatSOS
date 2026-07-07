from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import SocialAccount, User


@admin.register(User)
class AccountUserAdmin(UserAdmin):
    ordering = ('email',)
    list_display = (
        'email',
        'display_name',
        'preferred_language',
        'contribution_points',
        'is_email_verified',
        'is_staff',
        'is_active',
        'date_joined',
    )
    search_fields = ('email', 'display_name')

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name', 'profile_picture')}),
        (
            'Public profile',
            {
                'fields': (
                    'preferred_language',
                    'display_name',
                    'public_bio',
                    'public_location',
                    'public_email',
                    'public_phone',
                    'contribution_points',
                    'public_badges',
                )
            },
        ),
        (
            'Email verification',
            {'fields': ('is_email_verified', 'email_verification_sent_at', 'email_verified_at')},
        ),
        (
            'Notification preferences',
            {
                'fields': (
                    'notify_report_created_email',
                    'notify_sighting_created_email',
                    'notify_report_status_changed_email',
                )
            },
        ),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )


@admin.register(SocialAccount)
class SocialAccountAdmin(admin.ModelAdmin):
    list_display = ('provider', 'email', 'user', 'created_at')
    list_filter = ('provider',)
    search_fields = ('email', 'provider_user_id', 'user__email')
    add_fieldsets = (
        (
            None,
            {
                'classes': ('wide',),
                'fields': ('email', 'password1', 'password2'),
            },
        ),
    )
