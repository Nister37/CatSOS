from django.contrib import admin

from .models import Sighting


@admin.register(Sighting)
class SightingAdmin(admin.ModelAdmin):
    list_display = (
        'report',
        'submitted_by',
        'confidence',
        'verification_status',
        'seen_at',
        'created_at',
    )
    list_filter = ('confidence', 'verification_status', 'seen_at', 'created_at')
    search_fields = (
        'report__cat_name',
        'submitted_by__email',
        'location_description',
        'notes',
    )
    readonly_fields = ('id', 'created_at', 'updated_at')

# Register your models here.
