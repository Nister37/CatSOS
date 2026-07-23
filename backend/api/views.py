from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

VERSION = '0.1.0'


@extend_schema(
    responses=inline_serializer(
        name='HealthResponse',
        fields={
            'status': serializers.CharField(),
            'version': serializers.CharField(),
            'service': serializers.CharField(),
        },
    )
)
@api_view(['GET'])
@permission_classes([AllowAny])
def health(request):
    return Response({'status': 'ok', 'version': VERSION, 'service': 'catsos-backend'})
