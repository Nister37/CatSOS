from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from reports.models import LostCatReport

from .serializers import ReportQRCodeSerializer
from .services import build_report_qr_code_payload


def set_no_store_headers(response):
    response['Cache-Control'] = 'no-store'
    response['Pragma'] = 'no-cache'
    return response


def no_store_response(data, *, status_code=status.HTTP_200_OK):
    response = Response(data, status=status_code)
    return set_no_store_headers(response)


class ReportQRCodeView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'lost_report_write'

    def get_report(self):
        return get_object_or_404(
            LostCatReport.objects.filter(owner=self.request.user),
            pk=self.kwargs['pk'],
        )

    @extend_schema(
        request=None,
        responses={
            200: ReportQRCodeSerializer,
            400: OpenApiResponse(description='Validation errors'),
            401: OpenApiResponse(description='Authentication required'),
            404: OpenApiResponse(description='Report not found'),
        },
    )
    def post(self, request, pk):
        report = self.get_report()
        if report.moderation_status == LostCatReport.ModerationStatus.HIDDEN:
            raise ValidationError(
                {'report': ['QR codes cannot be generated for hidden reports.']}
            )

        serializer = ReportQRCodeSerializer(build_report_qr_code_payload(report))
        return no_store_response(serializer.data)
