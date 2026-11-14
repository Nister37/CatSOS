from django.urls import path

from .views import FoundCatDecisionTreeView, IntakeReportCreateView


urlpatterns = [
    path(
        'assistant/found-cat/decision-tree/',
        FoundCatDecisionTreeView.as_view(),
        name='found-cat-decision-tree',
    ),
    path(
        'assistant/intake/',
        IntakeReportCreateView.as_view(),
        name='assistant-intake',
    ),
]
