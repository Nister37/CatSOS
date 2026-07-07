from django.urls import path

from .views import DescriptionImproveView


urlpatterns = [
    path(
        'ai/improve-description/',
        DescriptionImproveView.as_view(),
        name='ai-improve-description',
    ),
]
