from django.urls import path

from .views import FoundCatDecisionTreeView


urlpatterns = [
    path(
        'assistant/found-cat/decision-tree/',
        FoundCatDecisionTreeView.as_view(),
        name='found-cat-decision-tree',
    ),
]
