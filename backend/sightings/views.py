from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from reports.models import LostCatReport

from .serializers import SightingCreateSerializer, SightingSerializer
from .services import create_sighting

ACTIVE_SEARCH_STATUSES = (
    LostCatReport.Status.MISSING,
    LostCatReport.Status.RECENTLY_SEEN,
)


def set_no_store_headers(response):
    response['Cache-Control'] = 'no-store'
    response['Pragma'] = 'no-cache'
    return response


def no_store_response(data, *, status_code=status.HTTP_200_OK):
    response = Response(data, status=status_code)
    return set_no_store_headers(response)


class PublicReportSightingCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'sighting_write'

    def get_report(self):
        return get_object_or_404(
            LostCatReport.objects.exclude(
                moderation_status=LostCatReport.ModerationStatus.HIDDEN,
            ),
            public_id=self.kwargs['public_id'],
        )

    @extend_schema(
        request=SightingCreateSerializer,
        responses={
            201: SightingSerializer,
            400: OpenApiResponse(description='Validation errors'),
            401: OpenApiResponse(description='Authentication required'),
            404: OpenApiResponse(description='Report not found'),
        },
    )
    def post(self, request, public_id):
        report = self.get_report()
        if report.status not in ACTIVE_SEARCH_STATUSES:
            raise ValidationError(
                {'report': ['Sightings can only be submitted for active reports.']}
            )

        serializer = SightingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = dict(serializer.validated_data)
        photo = validated_data.pop('photo', None)
        sighting = create_sighting(
            report=report,
            submitted_by=request.user,
            validated_data=validated_data,
            photo=photo,
        )
        response_serializer = SightingSerializer(
            sighting,
            context={'request': request},
        )
        return no_store_response(
            response_serializer.data,
            status_code=status.HTTP_201_CREATED,
        )
