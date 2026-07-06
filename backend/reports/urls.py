from django.urls import path

from .views import LostCatReportListCreateView

urlpatterns = [
    path('reports/', LostCatReportListCreateView.as_view(), name='lost-report-list'),
]
