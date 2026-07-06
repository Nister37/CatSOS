from django.urls import path

from .views import (
    LostCatReportDetailView,
    LostCatReportListCreateView,
    LostCatReportStatusView,
    LostCatReportTimelineView,
)

urlpatterns = [
    path('reports/', LostCatReportListCreateView.as_view(), name='lost-report-list'),
    path(
        'reports/<uuid:pk>/',
        LostCatReportDetailView.as_view(),
        name='lost-report-detail',
    ),
    path(
        'reports/<uuid:pk>/status/',
        LostCatReportStatusView.as_view(),
        name='lost-report-status',
    ),
    path(
        'reports/<uuid:pk>/timeline/',
        LostCatReportTimelineView.as_view(),
        name='lost-report-timeline',
    ),
]
