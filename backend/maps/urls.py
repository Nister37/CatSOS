from django.urls import path

from .views import NearbyHelpView

urlpatterns = [
    path('maps/nearby-help/', NearbyHelpView.as_view(), name='maps-nearby-help'),
]
