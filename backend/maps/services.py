import hashlib
import logging
import math
from urllib.request import urlopen, Request
from urllib.error import URLError
import json

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)


def haversine_km(lat1, lng1, lat2, lng2):
    """Calculate the great-circle distance between two points in km."""
    R = 6371.0
    lat1_r, lat2_r = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _build_overpass_query(lat, lng, radius_m):
    """Build an Overpass QL query for vets, shelters, and pet-related places."""
    area = f'around:{radius_m},{lat},{lng}'
    return f"""
[out:json][timeout:15];
(
  node["amenity"="veterinary"]({area});
  way["amenity"="veterinary"]({area});
  relation["amenity"="veterinary"]({area});
  node["office"="veterinary"]({area});
  way["office"="veterinary"]({area});
  relation["office"="veterinary"]({area});
  node["healthcare"="veterinary"]({area});
  way["healthcare"="veterinary"]({area});
  relation["healthcare"="veterinary"]({area});
  node["amenity"="animal_shelter"]({area});
  way["amenity"="animal_shelter"]({area});
  relation["amenity"="animal_shelter"]({area});
  node["animal_shelter"]({area});
  way["animal_shelter"]({area});
  relation["animal_shelter"]({area});
  node["shop"="pet"]({area});
  way["shop"="pet"]({area});
  relation["shop"="pet"]({area});
  node["amenity"="animal_boarding"]({area});
  way["amenity"="animal_boarding"]({area});
  relation["amenity"="animal_boarding"]({area});
);
out center;
""".strip()


def _fetch_overpass(query):
    """Send query to Overpass API and return parsed JSON."""
    url = getattr(settings, 'OVERPASS_API_URL', 'https://overpass-api.de/api/interpreter')
    data = f'data={query}'.encode('utf-8')
    request = Request(url, data=data, method='POST')
    request.add_header('Content-Type', 'application/x-www-form-urlencoded')
    with urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode('utf-8'))


def _classify_element(tags):
    """Classify an element as vet, shelter, or pet_help based on its tags."""
    amenity = tags.get('amenity', '')
    office = tags.get('office', '')
    healthcare = tags.get('healthcare', '')
    shop = tags.get('shop', '')

    if amenity == 'veterinary' or office == 'veterinary' or healthcare == 'veterinary':
        return 'vet'
    if amenity == 'animal_shelter' or 'animal_shelter' in tags:
        return 'shelter'
    if shop == 'pet' or amenity == 'animal_boarding':
        return 'pet_help'
    return 'pet_help'


def _extract_coordinates(element):
    """Extract lat/lng from a node or a way/relation with center."""
    if element.get('type') == 'node':
        return element.get('lat'), element.get('lon')
    center = element.get('center', {})
    if center:
        return center.get('lat'), center.get('lon')
    return None, None


def _quality_score(tags):
    """Calculate quality score for a place based on available metadata."""
    score = 0
    if tags.get('phone') or tags.get('contact:phone'):
        score += 3
    if tags.get('website') or tags.get('contact:website'):
        score += 2
    if tags.get('opening_hours'):
        score += 2
    if tags.get('addr:street') or tags.get('addr:city'):
        score += 1
    if tags.get('name'):
        score += 1
    else:
        score -= 3
    return score


def _normalize_element(element, origin_lat, origin_lng):
    """Convert an Overpass element into a normalized place dict."""
    tags = element.get('tags', {})
    lat, lng = _extract_coordinates(element)
    if lat is None or lng is None:
        return None

    category = _classify_element(tags)
    distance_km = haversine_km(origin_lat, origin_lng, lat, lng)
    quality = _quality_score(tags)

    phone = tags.get('phone') or tags.get('contact:phone') or ''
    website = tags.get('website') or tags.get('contact:website') or ''

    address_parts = []
    if tags.get('addr:street'):
        street = tags['addr:street']
        if tags.get('addr:housenumber'):
            street = f"{street} {tags['addr:housenumber']}"
        address_parts.append(street)
    if tags.get('addr:city'):
        address_parts.append(tags['addr:city'])
    if tags.get('addr:postcode'):
        address_parts.append(tags['addr:postcode'])

    return {
        'osm_id': element.get('id'),
        'osm_type': element.get('type'),
        'name': tags.get('name', ''),
        'category': category,
        'lat': lat,
        'lng': lng,
        'distance_km': round(distance_km, 2),
        'phone': phone,
        'website': website,
        'opening_hours': tags.get('opening_hours', ''),
        'address': ', '.join(address_parts),
        'quality_score': quality,
    }


def _deduplicate(places):
    """Remove duplicate places based on osm_id + osm_type."""
    seen = set()
    unique = []
    for place in places:
        key = (place['osm_type'], place['osm_id'])
        if key not in seen:
            seen.add(key)
            unique.append(place)
    return unique


def _sort_places(places):
    """Sort: vets/shelters before pet_help, then distance asc, then quality desc."""
    category_order = {'vet': 0, 'shelter': 0, 'pet_help': 1}

    return sorted(
        places,
        key=lambda p: (
            category_order.get(p['category'], 2),
            p['distance_km'],
            -p['quality_score'],
        ),
    )


def _cache_key(lat, lng, radius_km):
    """Generate a cache key from rounded coordinates and radius."""
    rounded_lat = round(lat, 2)
    rounded_lng = round(lng, 2)
    raw = f'nearby_help:{rounded_lat}:{rounded_lng}:{radius_km}'
    return f'nearby_help:{hashlib.md5(raw.encode()).hexdigest()}'


def fetch_nearby_help(lat, lng, radius_km=None):
    """
    Fetch nearby veterinary clinics, shelters, and pet-related places.

    Returns a dict with 'places' list and optional 'warning' string.
    """
    if radius_km is None:
        radius_km = getattr(settings, 'NEARBY_HELP_DEFAULT_RADIUS_KM', 10)

    cache_ttl = getattr(settings, 'NEARBY_HELP_CACHE_TTL_SECONDS', 86400)
    key = _cache_key(lat, lng, radius_km)

    cached = cache.get(key)
    if cached is not None:
        return cached

    radius_m = int(radius_km * 1000)
    query = _build_overpass_query(lat, lng, radius_m)

    try:
        data = _fetch_overpass(query)
    except (URLError, OSError, json.JSONDecodeError, ValueError) as exc:
        logger.warning('Overpass API request failed: %s', exc)
        result = {
            'places': [],
            'warning': (
                'Could not reach the map data provider. Please try again later. '
                'Data may be incomplete. Call before visiting.'
            ),
        }
        return result

    elements = data.get('elements', [])
    places = []
    for element in elements:
        normalized = _normalize_element(element, lat, lng)
        if normalized is not None:
            places.append(normalized)

    places = _deduplicate(places)
    places = _sort_places(places)

    result = {
        'places': places,
        'warning': 'Data may be incomplete. Call before visiting.' if places else (
            'No nearby places found. Data may be incomplete. Call before visiting.'
        ),
    }

    cache.set(key, result, cache_ttl)
    return result
