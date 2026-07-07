from django.urls import path

from .views import ReportQRCodeView

urlpatterns = [
    path(
        'reports/<uuid:pk>/qr-code/',
        ReportQRCodeView.as_view(),
        name='report-qr-code',
    ),
]
