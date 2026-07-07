from django.contrib import admin

from .models import InAppNotification


@admin.register(InAppNotification)
class InAppNotificationAdmin(admin.ModelAdmin):
    list_display = (
        'event_type',
        'recipient',
        'report',
        'is_read',
        'created_at',
    )
    list_filter = ('event_type', 'is_read', 'created_at')
    search_fields = ('recipient__email', 'title', 'message')
    readonly_fields = ('id', 'created_at', 'read_at')
