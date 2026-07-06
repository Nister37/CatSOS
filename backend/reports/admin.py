from django.contrib import admin

from .models import LostCatReport, LostCatReportTimelineEvent


class LostCatReportTimelineEventInline(admin.TabularInline):
    model = LostCatReportTimelineEvent
    extra = 0
    can_delete = False
    readonly_fields = (
        'id',
        'actor',
        'event_type',
        'from_status',
        'to_status',
        'location_summary',
        'created_at',
    )

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(LostCatReport)
class LostCatReportAdmin(admin.ModelAdmin):
    inlines = (LostCatReportTimelineEventInline,)
    list_display = (
        'cat_name',
        'owner',
        'status',
        'resolved_at',
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
    readonly_fields = ('id', 'public_id', 'resolved_at', 'created_at', 'updated_at')
    fieldsets = (
        ('Ownership', {'fields': ('id', 'public_id', 'owner')}),
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
                    'found_message',
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
        ('Timestamps', {'fields': ('resolved_at', 'created_at', 'updated_at')}),
    )


@admin.register(LostCatReportTimelineEvent)
class LostCatReportTimelineEventAdmin(admin.ModelAdmin):
    list_display = (
        'report',
        'event_type',
        'from_status',
        'to_status',
        'actor',
        'created_at',
    )
    list_filter = ('event_type', 'from_status', 'to_status', 'created_at')
    search_fields = ('report__cat_name', 'actor__email')
    readonly_fields = (
        'id',
        'report',
        'actor',
        'event_type',
        'from_status',
        'to_status',
        'location_summary',
        'created_at',
    )

    def has_add_permission(self, request):
        return False
