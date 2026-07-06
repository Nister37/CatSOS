from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.parsers import JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import LostCatReport
from .serializers import LostCatReportCreateSerializer, LostCatReportOwnerSerializer


def set_no_store_headers(response):
    response['Cache-Control'] = 'no-store'
    response['Pragma'] = 'no-cache'
    return response


def no_store_response(data, *, status_code=status.HTTP_200_OK):
    response = Response(data, status=status_code)
    return set_no_store_headers(response)


class LostCatReportListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'lost_report_write'

    def get_queryset(self):
        return LostCatReport.objects.filter(owner=self.request.user)

    @extend_schema(
        responses={
            200: LostCatReportOwnerSerializer(many=True),
            401: OpenApiResponse(description='Authentication required'),
        },
    )
    def get(self, request):
        serializer = LostCatReportOwnerSerializer(self.get_queryset(), many=True)
        return no_store_response(serializer.data)

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
