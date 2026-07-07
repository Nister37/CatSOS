from django.urls import path

from .views import InAppNotificationListView, InAppNotificationReadView

urlpatterns = [
    path('notifications/', InAppNotificationListView.as_view(), name='notification-list'),
    path(
        'notifications/<uuid:pk>/read/',
        InAppNotificationReadView.as_view(),
        name='notification-read',
    ),
]
