from django.urls import path

from .views import (
    LostCatReportDetailView,
    LostCatReportListCreateView,
    LostCatReportPhotoDetailView,
    LostCatReportPhotoListCreateView,
    LostCatReportPhotoMainView,
    LostCatReportPublicDetailView,
    LostCatReportPublicListView,
    LostCatReportSimilarView,
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
    path(
        'reports/<uuid:pk>/similar/',
        LostCatReportSimilarView.as_view(),
        name='lost-report-similar',
    ),
    path(
        'reports/<uuid:pk>/photos/',
        LostCatReportPhotoListCreateView.as_view(),
        name='lost-report-photo-list',
    ),
    path(
        'reports/<uuid:pk>/photos/<uuid:photo_id>/main/',
        LostCatReportPhotoMainView.as_view(),
        name='lost-report-photo-main',
    ),
    path(
        'reports/<uuid:pk>/photos/<uuid:photo_id>/',
        LostCatReportPhotoDetailView.as_view(),
        name='lost-report-photo-detail',
    ),
    path(
        'public/reports/',
        LostCatReportPublicListView.as_view(),
        name='lost-report-public-list',
    ),
    path(
        'public/reports/<uuid:public_id>/',
        LostCatReportPublicDetailView.as_view(),
        name='lost-report-public-detail',
    ),
]
