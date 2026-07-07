from django.urls import path

from .views import (
    PublicReportSightingCreateView,
    ReportSightingListView,
    ReportSightingVerificationView,
)

urlpatterns = [
    path(
        'reports/<uuid:pk>/sightings/',
        ReportSightingListView.as_view(),
        name='report-sighting-list',
    ),
    path(
        'reports/<uuid:pk>/sightings/<uuid:sighting_id>/verification/',
        ReportSightingVerificationView.as_view(),
        name='report-sighting-verification',
    ),
    path(
        'public/reports/<uuid:public_id>/sightings/',
        PublicReportSightingCreateView.as_view(),
        name='public-report-sighting-create',
    ),
]
