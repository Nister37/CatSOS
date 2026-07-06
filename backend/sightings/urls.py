from django.urls import path

from .views import PublicReportSightingCreateView

urlpatterns = [
    path(
        'public/reports/<uuid:public_id>/sightings/',
        PublicReportSightingCreateView.as_view(),
        name='public-report-sighting-create',
    ),
]
