from django.db import transaction
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from ai.serializers import (
    ReportTranslationSuggestionRequestSerializer,
    ReportTranslationSuggestionResponseSerializer,
)
from ai.services import suggest_report_translation

from .models import LostCatReport
from .serializers import (
    LostCatReportCreateSerializer,
    LostCatReportOwnerSerializer,
    LostCatReportPhotoSerializer,
    LostCatReportPhotoUploadSerializer,
    LostCatReportPublicListSerializer,
    LostCatReportPublicSerializer,
    LostCatReportSimilarReportSerializer,
    LostCatReportStatusUpdateSerializer,
    LostCatReportTimelineEventSerializer,
    LostCatReportUpdateSerializer,
)
from .services import (
    change_report_status,
    create_report_photo,
    delete_report_photo,
    find_similar_reports,
    handle_report_created,
    set_main_report_photo,
)

ACTIVE_SEARCH_STATUSES = (
    LostCatReport.Status.MISSING,
    LostCatReport.Status.RECENTLY_SEEN,
)
RESOLVED_REPORT_STATUSES = (
    LostCatReport.Status.FOUND,
    LostCatReport.Status.CLOSED,
)
TRUE_QUERY_VALUES = {'1', 'true', 'yes'}
FALSE_QUERY_VALUES = {'0', 'false', 'no'}
PUBLIC_STATUS_VALUES = {status_value for status_value, _label in LostCatReport.Status.choices}


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
    parser_classes = [JSONParser, MultiPartParser]

    def get_queryset(self):
        queryset = super().get_queryset()
        active = self.request.query_params.get('active')
        if active is None:
            return queryset

        normalized_active = active.strip().lower()
        if normalized_active in TRUE_QUERY_VALUES:
            return queryset.filter(status__in=ACTIVE_SEARCH_STATUSES)
        if normalized_active in FALSE_QUERY_VALUES:
            return queryset.filter(status__in=RESOLVED_REPORT_STATUSES)

        raise ValidationError({'active': ['Use true or false.']})

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
        serializer = LostCatReportCreateSerializer(
            data=request.data,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            report = serializer.save(owner=request.user)
            handle_report_created(
                report=report,
                actor=request.user,
            )
        response_serializer = LostCatReportOwnerSerializer(
            report,
            context={'request': request},
        )
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
            found_message=serializer.validated_data.get('found_message'),
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
        queryset = report.timeline_events.select_related('actor').order_by('created_at')
        paginator = LostCatReportTimelinePagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = LostCatReportTimelineEventSerializer(page, many=True)
        return set_no_store_headers(paginator.get_paginated_response(serializer.data))


class LostCatReportSimilarView(LostCatReportBaseView):
    @extend_schema(
        responses={
            200: LostCatReportSimilarReportSerializer(many=True),
            401: OpenApiResponse(description='Authentication required'),
            404: OpenApiResponse(description='Report not found'),
        },
    )
    def get(self, request, pk):
        report = self.get_object()
        similar_reports = find_similar_reports(report=report)
        serializer = LostCatReportSimilarReportSerializer(
            similar_reports,
            many=True,
            context={'request': request},
        )
        return no_store_response(
            {
                'count': len(serializer.data),
                'results': serializer.data,
            }
        )


class LostCatReportTranslationSuggestionView(LostCatReportBaseView):
    throttle_scope_by_method = {
        'POST': 'ai_write',
    }

    @extend_schema(
        request=ReportTranslationSuggestionRequestSerializer,
        responses={
            200: ReportTranslationSuggestionResponseSerializer,
            400: OpenApiResponse(description='Validation errors'),
            401: OpenApiResponse(description='Authentication required'),
            404: OpenApiResponse(description='Report not found'),
        },
    )
    def post(self, request, pk):
        report = self.get_object()
        serializer = ReportTranslationSuggestionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = suggest_report_translation(
            target_language=serializer.validated_data['target_language'],
            cat_name=report.cat_name,
            description=report.description,
            breed=report.breed,
            coat_color=report.coat_color,
            gender=report.get_gender_display(),
            collar_description=report.collar_description,
            personality=report.personality,
            last_seen_landmark=report.last_seen_landmark,
        )
        response_serializer = ReportTranslationSuggestionResponseSerializer(result)
        return no_store_response(response_serializer.data)


class LostCatReportPhotoListCreateView(LostCatReportBaseView):
    parser_classes = [MultiPartParser]

    @extend_schema(
        responses={
            200: LostCatReportPhotoSerializer(many=True),
            401: OpenApiResponse(description='Authentication required'),
            404: OpenApiResponse(description='Report not found'),
        },
    )
    def get(self, request, pk):
        report = self.get_object()
        serializer = LostCatReportPhotoSerializer(
            report.photos.all(),
            many=True,
            context={'request': request},
        )
        return no_store_response(serializer.data)

    @extend_schema(
        request=LostCatReportPhotoUploadSerializer,
        responses={
            201: LostCatReportPhotoSerializer,
            400: OpenApiResponse(description='Validation errors'),
            401: OpenApiResponse(description='Authentication required'),
            404: OpenApiResponse(description='Report not found'),
        },
    )
    def post(self, request, pk):
        report = self.get_object()
        serializer = LostCatReportPhotoUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        photo = create_report_photo(
            report=report,
            image=serializer.validated_data['photo'],
            is_main=serializer.validated_data.get('is_main', False),
        )
        response_serializer = LostCatReportPhotoSerializer(
            photo,
            context={'request': request},
        )
        return no_store_response(
            response_serializer.data,
            status_code=status.HTTP_201_CREATED,
        )


class LostCatReportPhotoBaseView(LostCatReportBaseView):
    def get_photo(self):
        report = self.get_object()
        return get_object_or_404(report.photos.all(), pk=self.kwargs['photo_id'])


class LostCatReportPhotoMainView(LostCatReportPhotoBaseView):
    @extend_schema(
        request=None,
        responses={
            200: LostCatReportPhotoSerializer,
            401: OpenApiResponse(description='Authentication required'),
            404: OpenApiResponse(description='Report photo not found'),
        },
    )
    def patch(self, request, pk, photo_id):
        photo = set_main_report_photo(photo=self.get_photo())
        serializer = LostCatReportPhotoSerializer(
            photo,
            context={'request': request},
        )
        return no_store_response(serializer.data)


class LostCatReportPhotoDetailView(LostCatReportPhotoBaseView):
    @extend_schema(
        request=None,
        responses={
            204: OpenApiResponse(description='Report photo deleted'),
            401: OpenApiResponse(description='Authentication required'),
            404: OpenApiResponse(description='Report photo not found'),
        },
    )
    def delete(self, request, pk, photo_id):
        delete_report_photo(photo=self.get_photo())
        response = Response(status=status.HTTP_204_NO_CONTENT)
        return set_no_store_headers(response)


class LostCatReportPublicDetailView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'lost_report_read'

    def get_queryset(self):
        return (
            LostCatReport.objects.exclude(
                moderation_status=LostCatReport.ModerationStatus.HIDDEN,
            )
            .prefetch_related('photos', 'timeline_events')
        )

    def get_object(self):
        return get_object_or_404(
            self.get_queryset(),
            public_id=self.kwargs['public_id'],
        )

    @extend_schema(
        responses={
            200: LostCatReportPublicSerializer,
            404: OpenApiResponse(description='Report not found'),
        },
    )
    def get(self, request, public_id):
        report = self.get_object()
        serializer = LostCatReportPublicSerializer(
            report,
            context={'request': request},
        )
        return no_store_response(serializer.data)


ALLOWED_ORDERING_FIELDS = {'created_at', '-created_at', 'cat_name', '-cat_name'}
DEFAULT_ORDERING = '-created_at'
DEFAULT_GEO_RADIUS_KM = 10.0
MAX_GEO_RADIUS_KM = 100.0
# Approximate km per degree latitude
KM_PER_DEGREE_LAT = 111.0


class LostCatReportPublicListView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'lost_report_read'

    def get_queryset(self):
        queryset = LostCatReport.objects.exclude(
            moderation_status=LostCatReport.ModerationStatus.HIDDEN,
        ).prefetch_related('photos')
        status_filter = self.request.query_params.get('status')
        active = self.request.query_params.get('active')

        if status_filter:
            normalized_status = status_filter.strip().upper()
            if normalized_status not in PUBLIC_STATUS_VALUES:
                raise ValidationError({'status': ['Use a valid report status.']})
            queryset = queryset.filter(status=normalized_status)
        elif active is None:
            queryset = queryset.filter(status__in=ACTIVE_SEARCH_STATUSES)
        else:
            normalized_active = active.strip().lower()
            if normalized_active in TRUE_QUERY_VALUES:
                queryset = queryset.filter(status__in=ACTIVE_SEARCH_STATUSES)
            elif normalized_active in FALSE_QUERY_VALUES:
                queryset = queryset.filter(status__in=RESOLVED_REPORT_STATUSES)
            else:
                raise ValidationError({'active': ['Use true or false.']})

        queryset = self._apply_search(queryset)
        queryset = self._apply_filters(queryset)
        queryset = self._apply_geo_filter(queryset)
        queryset = self._apply_ordering(queryset)

        return queryset

    def _apply_search(self, queryset):
        search = self.request.query_params.get('search', '').strip()
        if not search:
            return queryset

        from django.db.models import Q

        return queryset.filter(
            Q(cat_name__icontains=search)
            | Q(description__icontains=search)
            | Q(breed__icontains=search)
            | Q(coat_color__icontains=search)
            | Q(last_seen_landmark__icontains=search)
        )

    def _apply_filters(self, queryset):
        params = self.request.query_params

        breed = params.get('breed', '').strip()
        if breed:
            queryset = queryset.filter(breed__iexact=breed)

        coat_color = params.get('coat_color', '').strip()
        if coat_color:
            queryset = queryset.filter(coat_color__iexact=coat_color)

        gender = params.get('gender', '').strip()
        if gender:
            queryset = queryset.filter(gender__iexact=gender)

        city = params.get('city', '').strip()
        if city:
            queryset = queryset.filter(last_seen_address__icontains=city)

        return queryset

    def _apply_geo_filter(self, queryset):
        params = self.request.query_params
        lat_str = params.get('lat', '').strip()
        lng_str = params.get('lng', '').strip()

        if not lat_str or not lng_str:
            return queryset

        try:
            lat = float(lat_str)
            lng = float(lng_str)
        except (ValueError, TypeError):
            raise ValidationError({
                'lat': ['Provide valid numeric latitude and longitude.'],
            })

        if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
            raise ValidationError({
                'lat': ['Latitude must be between -90 and 90.'],
                'lng': ['Longitude must be between -180 and 180.'],
            })

        radius_km_str = params.get('radius_km', '').strip()
        if radius_km_str:
            try:
                radius_km = float(radius_km_str)
            except (ValueError, TypeError):
                raise ValidationError({
                    'radius_km': ['Provide a valid numeric radius.'],
                })
            if radius_km <= 0:
                raise ValidationError({
                    'radius_km': ['Radius must be positive.'],
                })
            radius_km = min(radius_km, MAX_GEO_RADIUS_KM)
        else:
            radius_km = DEFAULT_GEO_RADIUS_KM

        import math

        delta_lat = radius_km / KM_PER_DEGREE_LAT
        # Adjust longitude delta for latitude
        cos_lat = math.cos(math.radians(lat))
        if cos_lat > 0:
            delta_lng = radius_km / (KM_PER_DEGREE_LAT * cos_lat)
        else:
            delta_lng = 180.0

        min_lat = lat - delta_lat
        max_lat = lat + delta_lat
        min_lng = lng - delta_lng
        max_lng = lng + delta_lng

        queryset = queryset.filter(
            last_seen_lat__isnull=False,
            last_seen_lng__isnull=False,
            last_seen_lat__gte=min_lat,
            last_seen_lat__lte=max_lat,
            last_seen_lng__gte=min_lng,
            last_seen_lng__lte=max_lng,
        )

        return queryset

    def _apply_ordering(self, queryset):
        ordering = self.request.query_params.get('ordering', '').strip()
        if ordering and ordering in ALLOWED_ORDERING_FIELDS:
            return queryset.order_by(ordering)
        return queryset.order_by(DEFAULT_ORDERING)

    @extend_schema(
        responses={
            200: LostCatReportPublicListSerializer(many=True),
            400: OpenApiResponse(description='Validation errors'),
        },
    )
    def get(self, request):
        paginator = LostCatReportPagination()
        page = paginator.paginate_queryset(self.get_queryset(), request, view=self)
        serializer = LostCatReportPublicListSerializer(
            page,
            many=True,
            context={'request': request},
        )
        return set_no_store_headers(paginator.get_paginated_response(serializer.data))
