from django.contrib import admin

from .models import LostCatReport


@admin.register(LostCatReport)
class LostCatReportAdmin(admin.ModelAdmin):
    list_display = (
        'cat_name',
        'owner',
        'status',
        'contact_visibility',
        'moderation_status',
        'updated_at',
    )
    list_filter = ('status', 'contact_visibility', 'moderation_status', 'created_at')
    search_fields = (
        'cat_name',
        'breed',
        'coat_color',
        'last_seen_address',
        'owner__email',
        'contact_email',
    )
    readonly_fields = ('id', 'created_at', 'updated_at')
    fieldsets = (
        ('Ownership', {'fields': ('id', 'owner')}),
        (
            'Cat details',
            {
                'fields': (
                    'cat_name',
                    'age_years',
                    'breed',
                    'coat_color',
                    'eye_color',
                    'gender',
                    'collar_description',
                    'has_microchip',
                    'chip_number',
                    'personality',
                    'description',
                    'status',
                )
            },
        ),
        (
            'Last known location',
            {
                'fields': (
                    'disappeared_at',
                    'last_seen_address',
                    'last_seen_landmark',
                    'last_seen_lat',
                    'last_seen_lng',
                )
            },
        ),
        (
            'Contact and reward',
            {
                'fields': (
                    'contact_name',
                    'contact_phone',
                    'contact_email',
                    'contact_visibility',
                    'reward_amount',
                    'reward_note',
                    'notify_push',
                    'notify_sms',
                    'notify_email',
                )
            },
        ),
        (
            'Moderation',
            {'fields': ('moderation_status', 'moderation_notes')},
        ),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
    )
