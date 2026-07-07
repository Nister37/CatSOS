from django.contrib import admin

from .models import PointTransaction, UserBadge


@admin.register(PointTransaction)
class PointTransactionAdmin(admin.ModelAdmin):
    list_display = ('user', 'reason', 'points', 'created_at')
    list_filter = ('reason', 'created_at')
    search_fields = ('user__email', 'idempotency_key', 'description')
    readonly_fields = ('id', 'created_at')


@admin.register(UserBadge)
class UserBadgeAdmin(admin.ModelAdmin):
    list_display = ('user', 'code', 'label', 'awarded_at')
    list_filter = ('code', 'awarded_at')
    search_fields = ('user__email', 'label')
    readonly_fields = ('id', 'label', 'awarded_at')
