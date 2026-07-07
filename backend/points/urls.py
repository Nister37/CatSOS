from django.urls import path

from .views import LeaderboardView


urlpatterns = [
    path('points/leaderboard/', LeaderboardView.as_view(), name='points-leaderboard'),
]
