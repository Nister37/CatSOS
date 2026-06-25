from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


class HealthApiTests(APITestCase):
    def test_health_endpoint_returns_ok(self):
        response = self.client.get(reverse('api-health'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'ok')

    def test_openapi_schema_is_available_as_json(self):
        response = self.client.get(reverse('schema'), HTTP_ACCEPT='application/json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('openapi', response.data)
        self.assertEqual(response.data['info']['title'], 'CatSOS API')
