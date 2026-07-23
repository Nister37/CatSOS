from django.urls import path

from .admin_views import (
    AdminReportListView,
    AdminReportModerationView,
    AdminSightingModerationView,
    AdminStatsView,
)

urlpatterns = [
    path(
        'reports/',
        AdminReportListView.as_view(),
        name='admin-report-list',
    ),
    path(
        'reports/<uuid:pk>/moderation/',
        AdminReportModerationView.as_view(),
        name='admin-report-moderation',
    ),
    path(
        'sightings/<uuid:pk>/moderation/',
        AdminSightingModerationView.as_view(),
        name='admin-sighting-moderation',
    ),
    path(
        'stats/',
        AdminStatsView.as_view(),
        name='admin-stats',
    ),
]
