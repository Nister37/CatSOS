from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.parsers import JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .serializers import (
    DescriptionImproveRequestSerializer,
    DescriptionImproveResponseSerializer,
)
from .services import improve_lost_cat_description


def set_no_store_headers(response):
    response['Cache-Control'] = 'no-store'
    response['Pragma'] = 'no-cache'
    return response


class DescriptionImproveView(APIView):
    parser_classes = [JSONParser]
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'ai_write'

    @extend_schema(
        request=DescriptionImproveRequestSerializer,
        responses={
            200: DescriptionImproveResponseSerializer,
            400: OpenApiResponse(description='Validation errors'),
            401: OpenApiResponse(description='Authentication required'),
        },
    )
    def post(self, request):
        serializer = DescriptionImproveRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = improve_lost_cat_description(
            description=serializer.validated_data['description'],
        )
        response_serializer = DescriptionImproveResponseSerializer(result)
        return set_no_store_headers(
            Response(response_serializer.data, status=status.HTTP_200_OK)
        )
