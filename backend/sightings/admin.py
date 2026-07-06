from django.contrib import admin

from .models import Sighting, SightingPhoto


class SightingPhotoInline(admin.TabularInline):
    model = SightingPhoto
    extra = 0
    readonly_fields = ('id', 'uploaded_by', 'created_at')


@admin.register(Sighting)
class SightingAdmin(admin.ModelAdmin):
    inlines = (SightingPhotoInline,)
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


@admin.register(SightingPhoto)
class SightingPhotoAdmin(admin.ModelAdmin):
    list_display = ('sighting', 'uploaded_by', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('sighting__report__cat_name', 'uploaded_by__email')
    readonly_fields = ('id', 'sighting', 'uploaded_by', 'created_at')

# Register your models here.
