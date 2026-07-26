from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


class HealthApiTests(APITestCase):
    def test_health_endpoint_returns_ok(self):
        response = self.client.get(reverse('api-health'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'ok')

    def test_cors_allows_configured_frontend_origin(self):
        response = self.client.get(
            reverse('api-health'),
            HTTP_ORIGIN='http://localhost:5173',
        )

        self.assertEqual(response['Access-Control-Allow-Origin'], 'http://localhost:5173')
        self.assertIn('origin', response['Vary'].lower())

    def test_cors_does_not_allow_unconfigured_origin(self):
        response = self.client.get(
            reverse('api-health'),
            HTTP_ORIGIN='https://attacker.example',
        )

        self.assertNotIn('Access-Control-Allow-Origin', response)

    def test_response_has_csp_and_request_id_headers(self):
        response = self.client.get(
            reverse('api-health'),
            HTTP_X_REQUEST_ID='test-request-123',
        )

        self.assertEqual(response['X-Request-ID'], 'test-request-123')
        self.assertIn("default-src 'self'", response['Content-Security-Policy'])
        self.assertIn("object-src 'none'", response['Content-Security-Policy'])

    def test_invalid_request_id_is_replaced(self):
        response = self.client.get(
            reverse('api-health'),
            HTTP_X_REQUEST_ID='invalid request id with spaces',
        )

        self.assertNotEqual(
            response['X-Request-ID'],
            'invalid request id with spaces',
        )
        self.assertRegex(response['X-Request-ID'], r'^[a-f0-9]{32}$')

    def test_versioned_health_endpoint_matches_stable_contract(self):
        response = self.client.get('/api/v1/health/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'ok')

    def test_openapi_schema_is_available_as_json(self):
        response = self.client.get(reverse('schema'), HTTP_ACCEPT='application/json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('openapi', response.data)
        self.assertEqual(response.data['info']['title'], 'CatSOS API')
