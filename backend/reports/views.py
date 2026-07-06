from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import LostCatReport
from .serializers import (
    LostCatReportCreateSerializer,
    LostCatReportOwnerSerializer,
    LostCatReportStatusUpdateSerializer,
    LostCatReportTimelineEventSerializer,
    LostCatReportUpdateSerializer,
)
from .services import change_report_status


class LostCatReportPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class LostCatReportTimelinePagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


def set_no_store_headers(response):
    response['Cache-Control'] = 'no-store'
    response['Pragma'] = 'no-cache'
    return response


def no_store_response(data, *, status_code=status.HTTP_200_OK):
    response = Response(data, status=status_code)
    return set_no_store_headers(response)


class LostCatReportBaseView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'lost_report_read'
    throttle_scope_by_method = {
        'GET': 'lost_report_read',
        'PATCH': 'lost_report_write',
        'POST': 'lost_report_write',
        'PUT': 'lost_report_write',
    }

    def get_throttles(self):
        self.throttle_scope = self.throttle_scope_by_method.get(
            self.request.method,
            'lost_report_write',
        )
        return super().get_throttles()

    def get_queryset(self):
        return LostCatReport.objects.filter(owner=self.request.user)

    def get_object(self):
        return get_object_or_404(self.get_queryset(), pk=self.kwargs['pk'])


class LostCatReportListCreateView(LostCatReportBaseView):
    @extend_schema(
        responses={
            200: LostCatReportOwnerSerializer(many=True),
            401: OpenApiResponse(description='Authentication required'),
        },
    )
    def get(self, request):
        paginator = LostCatReportPagination()
        page = paginator.paginate_queryset(self.get_queryset(), request, view=self)
        serializer = LostCatReportOwnerSerializer(page, many=True)
        return set_no_store_headers(paginator.get_paginated_response(serializer.data))

    @extend_schema(
        request=LostCatReportCreateSerializer,
        responses={
            201: LostCatReportOwnerSerializer,
            400: OpenApiResponse(description='Validation errors'),
            401: OpenApiResponse(description='Authentication required'),
        },
    )
    def post(self, request):
        serializer = LostCatReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = serializer.save(owner=request.user)
        response_serializer = LostCatReportOwnerSerializer(report)
        return no_store_response(
            response_serializer.data,
            status_code=status.HTTP_201_CREATED,
        )


class LostCatReportDetailView(LostCatReportBaseView):
    @extend_schema(
        responses={
            200: LostCatReportOwnerSerializer,
            401: OpenApiResponse(description='Authentication required'),
            404: OpenApiResponse(description='Report not found'),
        },
    )
    def get(self, request, pk):
        report = self.get_object()
        serializer = LostCatReportOwnerSerializer(report)
        return no_store_response(serializer.data)

    @extend_schema(
        request=LostCatReportUpdateSerializer,
        responses={
            200: LostCatReportOwnerSerializer,
            400: OpenApiResponse(description='Validation errors'),
            401: OpenApiResponse(description='Authentication required'),
            404: OpenApiResponse(description='Report not found'),
        },
    )
    def patch(self, request, pk):
        return self._update(request, partial=True)

    @extend_schema(
        request=LostCatReportUpdateSerializer,
        responses={
            200: LostCatReportOwnerSerializer,
            400: OpenApiResponse(description='Validation errors'),
            401: OpenApiResponse(description='Authentication required'),
            404: OpenApiResponse(description='Report not found'),
        },
    )
    def put(self, request, pk):
        return self._update(request, partial=False)

    def _update(self, request, *, partial):
        report = self.get_object()
        serializer = LostCatReportUpdateSerializer(
            report,
            data=request.data,
            partial=partial,
        )
        serializer.is_valid(raise_exception=True)
        updated_report = serializer.save()
        response_serializer = LostCatReportOwnerSerializer(updated_report)
        return no_store_response(response_serializer.data)


class LostCatReportStatusView(LostCatReportBaseView):
    @extend_schema(
        request=LostCatReportStatusUpdateSerializer,
        responses={
            200: LostCatReportOwnerSerializer,
            400: OpenApiResponse(description='Validation errors'),
            401: OpenApiResponse(description='Authentication required'),
            404: OpenApiResponse(description='Report not found'),
        },
    )
    def patch(self, request, pk):
        report = self.get_object()
        serializer = LostCatReportStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated_report, _timeline_event = change_report_status(
            report=report,
            actor=request.user,
            new_status=serializer.validated_data['status'],
        )
        response_serializer = LostCatReportOwnerSerializer(updated_report)
        return no_store_response(response_serializer.data)


class LostCatReportTimelineView(LostCatReportBaseView):
    @extend_schema(
        responses={
            200: LostCatReportTimelineEventSerializer(many=True),
            401: OpenApiResponse(description='Authentication required'),
            404: OpenApiResponse(description='Report not found'),
        },
    )
    def get(self, request, pk):
        report = self.get_object()
        queryset = report.timeline_events.select_related('actor')
        paginator = LostCatReportTimelinePagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = LostCatReportTimelineEventSerializer(page, many=True)
        return set_no_store_headers(paginator.get_paginated_response(serializer.data))
