from django.urls import path

from .views import (
    PublicReportSightingCreateView,
    PublicReportVolunteerSearchCreateView,
    ReportSightingListView,
    ReportSightingVerificationView,
    ReportVolunteerSearchListView,
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
        'reports/<uuid:pk>/volunteer-searches/',
        ReportVolunteerSearchListView.as_view(),
        name='report-volunteer-search-list',
    ),
    path(
        'public/reports/<uuid:public_id>/sightings/',
        PublicReportSightingCreateView.as_view(),
        name='public-report-sighting-create',
    ),
    path(
        'public/reports/<uuid:public_id>/volunteer-searches/',
        PublicReportVolunteerSearchCreateView.as_view(),
        name='public-report-volunteer-search-create',
    ),
]
