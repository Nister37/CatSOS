from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from reports.models import LostCatReport
from .serializers import (
    SightingCreateSerializer,
    SightingOwnerSerializer,
    SightingSerializer,
    SightingVerificationUpdateSerializer,
)
from .services import create_sighting, update_sighting_verification

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


class ReportSightingPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class ReportSightingBaseView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'lost_report_read'
    throttle_scope_by_method = {
        'GET': 'lost_report_read',
        'PATCH': 'lost_report_write',
    }

    def get_throttles(self):
        self.throttle_scope = self.throttle_scope_by_method.get(
            self.request.method,
            'lost_report_write',
        )
        return super().get_throttles()

    def get_report_queryset(self):
        queryset = LostCatReport.objects.all()
        if self.request.user.is_staff:
            return queryset
        return queryset.filter(owner=self.request.user)

    def get_report(self):
        return get_object_or_404(self.get_report_queryset(), pk=self.kwargs['pk'])

    def get_sighting(self):
        report = self.get_report()
        return get_object_or_404(
            report.sightings.select_related('submitted_by', 'verified_by'),
            pk=self.kwargs['sighting_id'],
        )


class ReportSightingListView(ReportSightingBaseView):
    @extend_schema(
        responses={
            200: SightingOwnerSerializer(many=True),
            401: OpenApiResponse(description='Authentication required'),
            404: OpenApiResponse(description='Report not found'),
        },
    )
    def get(self, request, pk):
        report = self.get_report()
        queryset = (
            report.sightings.select_related('submitted_by', 'verified_by')
            .prefetch_related('photos')
            .order_by('-seen_at', '-created_at')
        )
        paginator = ReportSightingPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = SightingOwnerSerializer(
            page,
            many=True,
            context={'request': request},
        )
        return set_no_store_headers(paginator.get_paginated_response(serializer.data))


class ReportSightingVerificationView(ReportSightingBaseView):
    @extend_schema(
        request=SightingVerificationUpdateSerializer,
        responses={
            200: SightingOwnerSerializer,
            400: OpenApiResponse(description='Validation errors'),
            401: OpenApiResponse(description='Authentication required'),
            404: OpenApiResponse(description='Sighting not found'),
        },
    )
    def patch(self, request, pk, sighting_id):
        sighting = self.get_sighting()
        serializer = SightingVerificationUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated_sighting = update_sighting_verification(
            sighting=sighting,
            actor=request.user,
            verification_status=serializer.validated_data['verification_status'],
        )
        response_serializer = SightingOwnerSerializer(
            updated_sighting,
            context={'request': request},
        )
        return no_store_response(response_serializer.data)
