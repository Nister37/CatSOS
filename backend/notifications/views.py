from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import InAppNotification
from .serializers import InAppNotificationSerializer

TRUE_QUERY_VALUES = {'1', 'true', 'yes'}
FALSE_QUERY_VALUES = {'0', 'false', 'no'}


def set_no_store_headers(response):
    response['Cache-Control'] = 'no-store'
    response['Pragma'] = 'no-cache'
    return response


def no_store_response(data, *, status_code=status.HTTP_200_OK):
    response = Response(data, status=status_code)
    return set_no_store_headers(response)


class InAppNotificationPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class InAppNotificationBaseView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'notification_read'

    def get_queryset(self):
        return (
            InAppNotification.objects.filter(recipient=self.request.user)
            .select_related('report', 'sighting', 'actor')
            .order_by('-created_at')
        )


class InAppNotificationListView(InAppNotificationBaseView):
    def get_queryset(self):
        queryset = super().get_queryset()
        unread = self.request.query_params.get('unread')
        if unread is None:
            return queryset

        normalized_unread = unread.strip().lower()
        if normalized_unread in TRUE_QUERY_VALUES:
            return queryset.filter(is_read=False)
        if normalized_unread in FALSE_QUERY_VALUES:
            return queryset.filter(is_read=True)

        raise ValidationError({'unread': ['Use true or false.']})

    @extend_schema(
        responses={
            200: InAppNotificationSerializer(many=True),
            400: OpenApiResponse(description='Validation errors'),
            401: OpenApiResponse(description='Authentication required'),
        },
    )
    def get(self, request):
        paginator = InAppNotificationPagination()
        page = paginator.paginate_queryset(self.get_queryset(), request, view=self)
        serializer = InAppNotificationSerializer(page, many=True)
        return set_no_store_headers(paginator.get_paginated_response(serializer.data))


class InAppNotificationReadView(InAppNotificationBaseView):
    @extend_schema(
        request=None,
        responses={
            200: InAppNotificationSerializer,
            401: OpenApiResponse(description='Authentication required'),
            404: OpenApiResponse(description='Notification not found'),
        },
    )
    def patch(self, request, pk):
        notification = get_object_or_404(self.get_queryset(), pk=pk)
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save(update_fields=('is_read', 'read_at'))

        serializer = InAppNotificationSerializer(notification)
        return no_store_response(serializer.data)
