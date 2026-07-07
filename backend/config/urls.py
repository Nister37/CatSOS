"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from accounts.views import CurrentUserView, ProfilePictureView, PublicProfileView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/me/', CurrentUserView.as_view(), name='account-me'),
    path(
        'api/me/profile-picture/',
        ProfilePictureView.as_view(),
        name='account-profile-picture',
    ),
    path('api/profiles/<int:pk>/', PublicProfileView.as_view(), name='account-public-profile'),
    path('api/auth/', include('accounts.urls')),
    path('api/', include('reports.urls')),
    path('api/', include('sightings.urls')),
    path('api/', include('notifications.urls')),
    path('api/', include('posters.urls')),
    path('api/', include('api.urls')),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path(
        'api/docs/',
        SpectacularSwaggerView.as_view(url_name='schema'),
        name='swagger-ui',
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
