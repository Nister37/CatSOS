from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .serializers import (
    NearbyHelpQuerySerializer,
    NearbyHelpResponseSerializer,
)
from .services import fetch_nearby_help

OSM_ATTRIBUTION = '© OpenStreetMap contributors'


class NearbyHelpView(APIView):
    """Return nearby veterinary clinics, animal shelters, and pet-related places."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'nearby_help'

    def get(self, request):
        query_serializer = NearbyHelpQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)

        lat = query_serializer.validated_data['lat']
        lng = query_serializer.validated_data['lng']
        radius_km = query_serializer.validated_data['radius_km']

        result = fetch_nearby_help(lat, lng, radius_km)

        response_data = {
            'places': result['places'],
            'warning': result.get('warning', ''),
            'attribution': OSM_ATTRIBUTION,
        }

        response_serializer = NearbyHelpResponseSerializer(data=response_data)
        response_serializer.is_valid(raise_exception=True)

        return Response(response_serializer.validated_data)
