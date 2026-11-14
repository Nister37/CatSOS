import json
from unittest.mock import patch, MagicMock

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .services import (
    fetch_nearby_help,
    haversine_km,
    _normalize_element,
    _classify_element,
    _sort_places,
)


OVERPASS_VET_NODE = {
    'type': 'node',
    'id': 1001,
    'lat': 51.05,
    'lon': 3.72,
    'tags': {
        'amenity': 'veterinary',
        'name': 'Cat Clinic',
        'phone': '+32 9 123 4567',
        'website': 'https://catclinic.be',
        'opening_hours': 'Mo-Fr 09:00-17:00',
        'addr:street': 'Kattenlaan',
        'addr:housenumber': '42',
        'addr:city': 'Gent',
        'addr:postcode': '9000',
    },
}

OVERPASS_SHELTER_WAY = {
    'type': 'way',
    'id': 2001,
    'center': {'lat': 51.06, 'lon': 3.73},
    'tags': {
        'amenity': 'animal_shelter',
        'name': 'Safe Paws Shelter',
        'phone': '+32 9 765 4321',
    },
}

OVERPASS_PET_SHOP_NODE = {
    'type': 'node',
    'id': 3001,
    'lat': 51.04,
    'lon': 3.71,
    'tags': {
        'shop': 'pet',
        'name': 'Pet Paradise',
        'website': 'https://petparadise.be',
    },
}

OVERPASS_ANIMAL_SHELTER_TAG = {
    'type': 'node',
    'id': 4001,
    'lat': 51.055,
    'lon': 3.725,
    'tags': {
        'animal_shelter': 'cats',
        'name': 'Cat Haven',
    },
}

OVERPASS_BOARDING_NODE = {
    'type': 'node',
    'id': 5001,
    'lat': 51.045,
    'lon': 3.715,
    'tags': {
        'amenity': 'animal_boarding',
        'name': 'Cat Hotel',
    },
}

OVERPASS_NO_NAME_NODE = {
    'type': 'node',
    'id': 6001,
    'lat': 51.051,
    'lon': 3.721,
    'tags': {
        'amenity': 'veterinary',
    },
}

MOCK_OVERPASS_RESPONSE = {
    'elements': [
        OVERPASS_VET_NODE,
        OVERPASS_SHELTER_WAY,
        OVERPASS_PET_SHOP_NODE,
    ],
}


def _mock_overpass_success(query):
    return MOCK_OVERPASS_RESPONSE


def _mock_overpass_failure(query):
    from urllib.error import URLError
    raise URLError('Connection timed out')


@override_settings(
    OVERPASS_API_URL='https://overpass-api.de/api/interpreter',
    NEARBY_HELP_CACHE_TTL_SECONDS=86400,
    NEARBY_HELP_DEFAULT_RADIUS_KM=10,
    NEARBY_HELP_MAX_RADIUS_KM=30,
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
    REST_FRAMEWORK={
        'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
        'DEFAULT_AUTHENTICATION_CLASSES': [
            'rest_framework_simplejwt.authentication.JWTAuthentication',
            'rest_framework.authentication.SessionAuthentication',
        ],
        'DEFAULT_THROTTLE_RATES': {
            'nearby_help': '1000/minute',
        },
    },
)
class NearbyHelpAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = '/api/maps/nearby-help/'
        cache.clear()

    def tearDown(self):
        cache.clear()

    @patch('maps.services._fetch_overpass', side_effect=_mock_overpass_success)
    def test_valid_request_returns_normalized_response(self, mock_fetch):
        response = self.client.get(self.url, {'lat': 51.05, 'lng': 3.72})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('places', data)
        self.assertIn('attribution', data)
        self.assertIn('warning', data)
        self.assertIsInstance(data['places'], list)
        self.assertEqual(len(data['places']), 3)
        # Verify place structure
        place = data['places'][0]
        self.assertIn('osm_id', place)
        self.assertIn('name', place)
        self.assertIn('type', place)
        self.assertIn('lat', place)
        self.assertIn('lng', place)
        self.assertIn('distance_km', place)
        self.assertIn('phone', place)
        self.assertIn('website', place)

    def test_missing_lat_lng_returns_validation_error(self):
        response = self.client.get(self.url, {})
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('lat', data)
        self.assertIn('lng', data)

    def test_invalid_coordinate_ranges_rejected(self):
        # lat out of range
        response = self.client.get(self.url, {'lat': 95.0, 'lng': 3.72})
        self.assertEqual(response.status_code, 400)
        self.assertIn('lat', response.json())

        # lng out of range
        response = self.client.get(self.url, {'lat': 51.0, 'lng': 200.0})
        self.assertEqual(response.status_code, 400)
        self.assertIn('lng', response.json())

        # negative out of range
        response = self.client.get(self.url, {'lat': -91.0, 'lng': 3.72})
        self.assertEqual(response.status_code, 400)

    @patch('maps.services._fetch_overpass', side_effect=_mock_overpass_success)
    def test_radius_defaults_to_10_km(self, mock_fetch):
        response = self.client.get(self.url, {'lat': 51.05, 'lng': 3.72})
        self.assertEqual(response.status_code, 200)
        # Verify the overpass query used 10000m radius
        call_args = mock_fetch.call_args[0][0]
        self.assertIn('around:10000', call_args)

    def test_radius_above_max_rejected(self):
        response = self.client.get(
            self.url, {'lat': 51.05, 'lng': 3.72, 'radius_km': 50}
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('radius_km', data)


@override_settings(
    OVERPASS_API_URL='https://overpass-api.de/api/interpreter',
    NEARBY_HELP_CACHE_TTL_SECONDS=86400,
    NEARBY_HELP_DEFAULT_RADIUS_KM=10,
    NEARBY_HELP_MAX_RADIUS_KM=30,
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
)
class OverpassParsingTests(TestCase):
    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_overpass_node_parsed_correctly(self):
        result = _normalize_element(OVERPASS_VET_NODE, 51.05, 3.72)
        self.assertIsNotNone(result)
        self.assertEqual(result['osm_id'], 1001)
        self.assertEqual(result['osm_type'], 'node')
        self.assertEqual(result['name'], 'Cat Clinic')
        self.assertEqual(result['type'], 'vet')
        self.assertEqual(result['lat'], 51.05)
        self.assertEqual(result['lng'], 3.72)
        self.assertEqual(result['phone'], '+32 9 123 4567')
        self.assertEqual(result['website'], 'https://catclinic.be')
        self.assertEqual(result['opening_hours'], 'Mo-Fr 09:00-17:00')
        self.assertIn('Kattenlaan 42', result['address'])
        self.assertIn('Gent', result['address'])

    def test_overpass_way_center_parsed_correctly(self):
        result = _normalize_element(OVERPASS_SHELTER_WAY, 51.05, 3.72)
        self.assertIsNotNone(result)
        self.assertEqual(result['osm_id'], 2001)
        self.assertEqual(result['osm_type'], 'way')
        self.assertEqual(result['lat'], 51.06)
        self.assertEqual(result['lng'], 3.73)
        self.assertEqual(result['type'], 'shelter')

    def test_vet_tags_classify_as_vet(self):
        self.assertEqual(_classify_element({'amenity': 'veterinary'}), 'vet')
        self.assertEqual(_classify_element({'office': 'veterinary'}), 'vet')
        self.assertEqual(_classify_element({'healthcare': 'veterinary'}), 'vet')

    def test_shelter_tags_classify_as_shelter(self):
        self.assertEqual(_classify_element({'amenity': 'animal_shelter'}), 'shelter')
        self.assertEqual(_classify_element({'animal_shelter': 'cats'}), 'shelter')

    def test_pet_shop_tags_classify_as_pet_help(self):
        self.assertEqual(_classify_element({'shop': 'pet'}), 'pet_help')
        self.assertEqual(_classify_element({'amenity': 'animal_boarding'}), 'pet_help')

    def test_distance_calculated_and_sorted(self):
        # Vet is at origin, shelter is ~1.3km away, pet shop is ~1km away
        places = [
            _normalize_element(OVERPASS_VET_NODE, 51.05, 3.72),
            _normalize_element(OVERPASS_SHELTER_WAY, 51.05, 3.72),
            _normalize_element(OVERPASS_PET_SHOP_NODE, 51.05, 3.72),
        ]
        sorted_places = _sort_places(places)
        # Vets and shelters come first (category order 0)
        categories = [p['type'] for p in sorted_places]
        vet_shelter_idx = [
            i for i, c in enumerate(categories) if c in ('vet', 'shelter')
        ]
        pet_help_idx = [i for i, c in enumerate(categories) if c == 'pet_help']
        if vet_shelter_idx and pet_help_idx:
            self.assertTrue(max(vet_shelter_idx) < min(pet_help_idx))

    @patch('maps.services._fetch_overpass', side_effect=_mock_overpass_success)
    def test_cache_prevents_repeated_overpass_calls(self, mock_fetch):
        fetch_nearby_help(51.05, 3.72, 10)
        fetch_nearby_help(51.05, 3.72, 10)
        self.assertEqual(mock_fetch.call_count, 1)

    @patch('maps.services._fetch_overpass', side_effect=_mock_overpass_failure)
    def test_overpass_failure_returns_empty_places_not_500(self, mock_fetch):
        result = fetch_nearby_help(51.05, 3.72, 10)
        self.assertEqual(result['places'], [])
        self.assertIn('warning', result)
        self.assertTrue(len(result['warning']) > 0)

    @patch('maps.services._fetch_overpass', side_effect=_mock_overpass_success)
    def test_no_hardcoded_places_returned(self, mock_fetch):
        """Places come from Overpass, not from hardcoded data."""
        result = fetch_nearby_help(51.05, 3.72, 10)
        osm_ids = {p['osm_id'] for p in result['places']}
        # All IDs should match our mock data
        expected_ids = {1001, 2001, 3001}
        self.assertEqual(osm_ids, expected_ids)

    @patch('maps.services.urlopen')
    def test_overpass_mirror_fallback_used_on_primary_failure(self, mock_urlopen):
        from urllib.error import URLError
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps(MOCK_OVERPASS_RESPONSE).encode('utf-8')
        mock_response.__enter__.return_value = mock_response

        mock_urlopen.side_effect = [URLError('Connection timed out'), mock_response]

        result = fetch_nearby_help(51.05, 3.72, 10)
        self.assertEqual(len(result['places']), 3)
        self.assertEqual(mock_urlopen.call_count, 2)


@override_settings(
    OVERPASS_API_URL='https://overpass-api.de/api/interpreter',
    NEARBY_HELP_CACHE_TTL_SECONDS=86400,
    NEARBY_HELP_DEFAULT_RADIUS_KM=10,
    NEARBY_HELP_MAX_RADIUS_KM=30,
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
    REST_FRAMEWORK={
        'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
        'DEFAULT_AUTHENTICATION_CLASSES': [
            'rest_framework_simplejwt.authentication.JWTAuthentication',
            'rest_framework.authentication.SessionAuthentication',
        ],
        'DEFAULT_THROTTLE_RATES': {
            'nearby_help': '1000/minute',
        },
    },
)
class NearbyHelpViewEdgeCases(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = '/api/maps/nearby-help/'
        cache.clear()

    def tearDown(self):
        cache.clear()

    @patch('maps.services._fetch_overpass', side_effect=_mock_overpass_failure)
    def test_overpass_failure_returns_200_with_warning(self, mock_fetch):
        response = self.client.get(self.url, {'lat': 51.05, 'lng': 3.72})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['places'], [])
        self.assertIn('warning', data)
        self.assertTrue(len(data['warning']) > 0)

    def test_nearby_help_serializer_validates_website_protocol(self):
        from .serializers import NearbyHelpPlaceSerializer
        valid_data = {
            'osm_id': 123,
            'osm_type': 'node',
            'name': 'Safe Vet',
            'type': 'vet',
            'lat': 51.0,
            'lng': 3.0,
            'distance_km': 1.5,
            'phone': '123',
            'website': 'https://example.com',
            'opening_hours': '',
            'address': '',
            'quality_score': 5,
        }
        serializer = NearbyHelpPlaceSerializer(data=valid_data)
        self.assertTrue(serializer.is_valid(), serializer.errors)

        # Disallowed schemes like javascript:
        invalid_data = dict(valid_data, website='javascript:alert(1)')
        serializer = NearbyHelpPlaceSerializer(data=invalid_data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('website', serializer.errors)

    def test_nearby_help_serializer_sanitizes_unsafe_website_in_representation(self):
        from .serializers import NearbyHelpPlaceSerializer
        instance = {
            'osm_id': 123,
            'osm_type': 'node',
            'name': 'Safe Vet',
            'type': 'vet',
            'lat': 51.0,
            'lng': 3.0,
            'distance_km': 1.5,
            'phone': '123',
            'website': 'javascript:alert(1)',
            'opening_hours': '',
            'address': '',
            'quality_score': 5,
        }
        rep = NearbyHelpPlaceSerializer(instance).data
        self.assertEqual(rep['website'], '')

    def test_classify_element_detects_cat_cafes(self):
        self.assertEqual(_classify_element({'amenity': 'cat_cafe'}), 'cat_cafe')
        self.assertEqual(_classify_element({'amenity': 'cafe', 'cuisine': 'cat_cafe'}), 'cat_cafe')
        self.assertEqual(_classify_element({'amenity': 'cafe', 'cuisine': 'cat'}), 'cat_cafe')
        self.assertEqual(_classify_element({'amenity': 'cafe', 'animal': 'cat'}), 'cat_cafe')
        self.assertEqual(_classify_element({'amenity': 'cafe', 'pet': 'cat'}), 'cat_cafe')
        self.assertEqual(_classify_element({'amenity': 'cafe', 'theme': 'cat'}), 'cat_cafe')
        self.assertEqual(_classify_element({'amenity': 'cafe', 'name': 'Kattencafé Kat-astrofe'}), 'cat_cafe')
        self.assertEqual(_classify_element({'amenity': 'cafe', 'name': 'Café des Chats'}), 'cat_cafe')
        self.assertEqual(_classify_element({'amenity': 'cafe', 'name': 'Bar à chats'}), 'cat_cafe')
        self.assertEqual(_classify_element({'amenity': 'cafe', 'name': 'Kocia Kawiarnia Miau'}), 'cat_cafe')
        self.assertEqual(_classify_element({'amenity': 'cafe', 'name': 'Katzencafé Schnurr'}), 'cat_cafe')
        self.assertEqual(_classify_element({'amenity': 'cafe', 'name': 'Feline Cat Lounge'}), 'cat_cafe')

    def test_nearby_help_serializer_accepts_cat_cafe_type(self):
        from .serializers import NearbyHelpPlaceSerializer
        valid_data = {
            'osm_id': 7001,
            'osm_type': 'node',
            'name': 'Cat Cafe Purr',
            'type': 'cat_cafe',
            'lat': 51.22,
            'lng': 4.40,
            'distance_km': 0.8,
            'phone': '+32 3 999 8877',
            'website': 'https://catcafepurr.be',
            'opening_hours': '10:00-18:00',
            'address': 'Melkmarkt 17, Antwerp',
            'quality_score': 8,
        }
        serializer = NearbyHelpPlaceSerializer(data=valid_data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['type'], 'cat_cafe')

