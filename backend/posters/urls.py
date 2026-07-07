from django.urls import path

from .views import ReportPosterView, ReportQRCodeView

urlpatterns = [
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
