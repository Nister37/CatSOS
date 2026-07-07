from rest_framework import serializers


class ReportQRCodeSerializer(serializers.Serializer):
    public_url = serializers.URLField(read_only=True)
    qr_code = serializers.CharField(read_only=True)
    content_type = serializers.CharField(read_only=True)
