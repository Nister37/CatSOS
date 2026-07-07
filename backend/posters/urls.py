from django.urls import path

from .views import ReportPosterTextSuggestionView, ReportPosterView, ReportQRCodeView

urlpatterns = [
    path(
        'reports/<uuid:pk>/poster-text-suggestion/',
        ReportPosterTextSuggestionView.as_view(),
        name='report-poster-text-suggestion',
    ),
    path(
        'reports/<uuid:pk>/poster/',
        ReportPosterView.as_view(),
        name='report-poster',
    ),
    path(
        'reports/<uuid:pk>/qr-code/',
        ReportQRCodeView.as_view(),
        name='report-qr-code',
    ),
]
