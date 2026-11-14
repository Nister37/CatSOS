from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .decision_tree import FOUND_CAT_DECISION_TREE
from .serializers import FoundCatDecisionTreeSerializer, IntakeReportSerializer


def set_no_store_headers(response):
    response['Cache-Control'] = 'no-store'
    response['Pragma'] = 'no-cache'
    return response


class FoundCatDecisionTreeView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'assistant_read'

    @extend_schema(responses={200: FoundCatDecisionTreeSerializer})
    def get(self, request):
        return set_no_store_headers(Response(FOUND_CAT_DECISION_TREE))


class IntakeReportCreateView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'assistant_write'

    @extend_schema(
        request=IntakeReportSerializer,
        responses={201: IntakeReportSerializer},
    )
    def post(self, request):
        serializer = IntakeReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return set_no_store_headers(
            Response(serializer.data, status=status.HTTP_201_CREATED)
        )
