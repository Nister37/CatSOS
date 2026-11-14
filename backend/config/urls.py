from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from accounts.views import CurrentUserView, ProfilePictureView, PublicProfileView

api_patterns = [
    path('admin/', include('reports.admin_urls')),
    path('me/', CurrentUserView.as_view(), name='account-me'),
    path(
        'me/profile-picture/',
        ProfilePictureView.as_view(),
        name='account-profile-picture',
    ),
    path('profiles/<int:pk>/', PublicProfileView.as_view(), name='account-public-profile'),
    path('auth/', include('accounts.urls')),
    path('', include('ai.urls')),
    path('', include('assistant.urls')),
    path('', include('reports.urls')),
    path('', include('sightings.urls')),
    path('', include('notifications.urls')),
    path('', include('posters.urls')),
    path('', include('points.urls')),
    path('', include('maps.urls')),
    path('', include('api.urls')),
]

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(api_patterns)),
    path(
        'api/v1/',
        include((api_patterns, 'api-v1'), namespace='api-v1'),
    ),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path(
        'api/docs/',
        SpectacularSwaggerView.as_view(url_name='schema'),
        name='swagger-ui',
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
