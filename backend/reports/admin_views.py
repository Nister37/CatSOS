from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from reports.models import LostCatReport
from sightings.models import Sighting

from .admin_serializers import (
    AdminReportListSerializer,
    AdminReportModerationSerializer,
    AdminSightingModerationSerializer,
    AdminStatsSerializer,
)

User = get_user_model()

ACTIVE_REPORT_STATUSES = (
    LostCatReport.Status.MISSING,
    LostCatReport.Status.RECENTLY_SEEN,
)


class AdminReportPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class AdminReportModerationView(APIView):
    """Change a report's moderation_status. Staff only."""

    permission_classes = [IsAdminUser]

    @extend_schema(
        request=AdminReportModerationSerializer,
        responses={
            200: AdminReportModerationSerializer,
            400: OpenApiResponse(description='Validation errors'),
            401: OpenApiResponse(description='Authentication required'),
            403: OpenApiResponse(description='Admin access required'),
            404: OpenApiResponse(description='Report not found'),
        },
    )
    def patch(self, request, pk):
        report = get_object_or_404(LostCatReport, pk=pk)
        serializer = AdminReportModerationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        report.moderation_status = serializer.validated_data['moderation_status']
        moderation_notes = serializer.validated_data.get('moderation_notes')
        if moderation_notes is not None:
            report.moderation_notes = moderation_notes

        report.save(update_fields=['moderation_status', 'moderation_notes', 'updated_at'])

        return Response(
            {
                'id': str(report.id),
                'moderation_status': report.moderation_status,
                'moderation_notes': report.moderation_notes,
            },
            status=status.HTTP_200_OK,
        )


class AdminSightingModerationView(APIView):
    """Change a sighting's verification_status. Staff only."""

    permission_classes = [IsAdminUser]

    @extend_schema(
        request=AdminSightingModerationSerializer,
        responses={
            200: AdminSightingModerationSerializer,
            400: OpenApiResponse(description='Validation errors'),
            401: OpenApiResponse(description='Authentication required'),
            403: OpenApiResponse(description='Admin access required'),
            404: OpenApiResponse(description='Sighting not found'),
        },
    )
    def patch(self, request, pk):
        sighting = get_object_or_404(Sighting, pk=pk)
        serializer = AdminSightingModerationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        from django.utils import timezone

        sighting.verification_status = serializer.validated_data['verification_status']
        sighting.verified_by = request.user
        sighting.verified_at = timezone.now()
        sighting.save(
            update_fields=[
                'verification_status',
                'verified_by',
                'verified_at',
                'updated_at',
            ]
        )

        return Response(
            {
                'id': str(sighting.id),
                'verification_status': sighting.verification_status,
                'verified_at': sighting.verified_at.isoformat(),
            },
            status=status.HTTP_200_OK,
        )


class AdminReportListView(APIView):
    """List all reports with optional moderation_status filter. Staff only."""

    permission_classes = [IsAdminUser]

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name='moderation_status',
                description='Filter by moderation status',
                required=False,
                type=str,
                enum=[choice[0] for choice in LostCatReport.ModerationStatus.choices],
            ),
            OpenApiParameter(
                name='page',
                description='Page number',
                required=False,
                type=int,
            ),
            OpenApiParameter(
                name='page_size',
                description='Page size',
                required=False,
                type=int,
            ),
        ],
        responses={
            200: AdminReportListSerializer(many=True),
            401: OpenApiResponse(description='Authentication required'),
            403: OpenApiResponse(description='Admin access required'),
        },
    )
    def get(self, request):
        queryset = LostCatReport.objects.select_related('owner').prefetch_related(
            'photos'
        ).order_by('-updated_at')

        moderation_status = request.query_params.get('moderation_status')
        if moderation_status and moderation_status in {
            choice[0] for choice in LostCatReport.ModerationStatus.choices
        }:
            queryset = queryset.filter(moderation_status=moderation_status)

        paginator = AdminReportPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = AdminReportListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class AdminStatsView(APIView):
    """Return admin dashboard statistics. Staff only."""

    permission_classes = [IsAdminUser]

    @extend_schema(
        responses={
            200: AdminStatsSerializer,
            401: OpenApiResponse(description='Authentication required'),
            403: OpenApiResponse(description='Admin access required'),
        },
    )
    def get(self, request):
        total_reports = LostCatReport.objects.count()
        active_reports = LostCatReport.objects.filter(
            status__in=ACTIVE_REPORT_STATUSES,
        ).count()
        total_sightings = Sighting.objects.count()
        total_users = User.objects.count()
        reports_under_review = LostCatReport.objects.filter(
            moderation_status=LostCatReport.ModerationStatus.PENDING,
        ).count()

        data = {
            'total_reports': total_reports,
            'active_reports': active_reports,
            'total_sightings': total_sightings,
            'total_users': total_users,
            'reports_under_review': reports_under_review,
        }
        serializer = AdminStatsSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)
