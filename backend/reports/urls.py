from django.urls import path

from .views import LostCatReportDetailView, LostCatReportListCreateView

urlpatterns = [
    path('reports/', LostCatReportListCreateView.as_view(), name='lost-report-list'),
    path(
        'reports/<uuid:pk>/',
        LostCatReportDetailView.as_view(),
        name='lost-report-detail',
    ),
]
