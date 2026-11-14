from django.contrib import admin

from .models import IntakeReport


@admin.register(IntakeReport)
class IntakeReportAdmin(admin.ModelAdmin):
    list_display = ('id', 'cat_name', 'reporter_email', 'urgency', 'status', 'created_at')
    list_filter = ('urgency', 'status', 'created_at')
    search_fields = ('cat_name', 'reporter_email', 'description')
    readonly_fields = ('created_at', 'updated_at')
