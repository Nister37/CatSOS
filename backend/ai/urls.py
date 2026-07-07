from django.urls import path

from .views import DescriptionImproveView, PublicSummaryView


urlpatterns = [
    path(
        'ai/improve-description/',
        DescriptionImproveView.as_view(),
        name='ai-improve-description',
    ),
    path(
        'ai/public-summary/',
        PublicSummaryView.as_view(),
        name='ai-public-summary',
    ),
]
