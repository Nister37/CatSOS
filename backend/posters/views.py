from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from drf_spectacular.types import OpenApiTypes
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
from .services import (
    POSTER_CONTENT_TYPE,
    build_report_qr_code_payload,
    generate_report_poster_pdf,
)


def set_no_store_headers(response):
    response['Cache-Control'] = 'no-store'
    response['Pragma'] = 'no-cache'
    return response


def no_store_response(data, *, status_code=status.HTTP_200_OK):
    response = Response(data, status=status_code)
    return set_no_store_headers(response)


def no_store_file_response(content, *, content_type, filename):
    response = HttpResponse(content, content_type=content_type)
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return set_no_store_headers(response)


def build_report_poster_filename(report):
    slug = slugify(report.cat_name) or 'lost-cat-report'
    return f'{slug}-poster.pdf'


class OwnedReportPosterBaseView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'lost_report_write'

    def get_report(self):
        return get_object_or_404(
            LostCatReport.objects.filter(owner=self.request.user).prefetch_related(
                'photos',
            ),
            pk=self.kwargs['pk'],
        )

    def validate_public_artifact_allowed(self, report, artifact_name):
        if report.moderation_status == LostCatReport.ModerationStatus.HIDDEN:
            raise ValidationError(
                {
                    'report': [
                        f'{artifact_name} cannot be generated for hidden reports.'
                    ]
                }
            )


class ReportQRCodeView(OwnedReportPosterBaseView):
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
        self.validate_public_artifact_allowed(report, 'QR codes')

        serializer = ReportQRCodeSerializer(build_report_qr_code_payload(report))
        return no_store_response(serializer.data)


class ReportPosterView(OwnedReportPosterBaseView):
    @extend_schema(
        request=None,
        responses={
            200: OpenApiResponse(
                response=OpenApiTypes.BINARY,
                description='Printable A4 PDF poster',
            ),
            400: OpenApiResponse(description='Validation errors'),
            401: OpenApiResponse(description='Authentication required'),
            404: OpenApiResponse(description='Report not found'),
        },
    )
    def post(self, request, pk):
        report = self.get_report()
        self.validate_public_artifact_allowed(report, 'Posters')

        return no_store_file_response(
            generate_report_poster_pdf(report),
            content_type=POSTER_CONTENT_TYPE,
            filename=build_report_poster_filename(report),
        )
