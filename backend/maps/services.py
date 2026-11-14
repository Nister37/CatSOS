import hashlib
import logging
import math
from urllib.request import urlopen, Request
from urllib.error import URLError
import json

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

OVERPASS_MIRRORS = [
    'https://overpass.private.coffee/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter',
]


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


def _calculate_bbox(lat, lng, radius_m):
    """Calculate (south, west, north, east) bounding box for fast Overpass R-tree indexing."""
    radius_km = radius_m / 1000.0
    d_lat = radius_km / 111.0
    cos_lat = max(0.01, math.cos(math.radians(lat)))
    d_lng = radius_km / (111.0 * cos_lat)
    s = round(lat - d_lat, 4)
    n = round(lat + d_lat, 4)
    w = round(min(lng - d_lng, lng + d_lng), 4)
    e = round(max(lng - d_lng, lng + d_lng), 4)
    return s, w, n, e


def _build_overpass_query(lat, lng, radius_m):
    """Build a fast, focused Overpass QL query for vets, shelters, cat cafes, and pet-related places."""
    area = f'around:{radius_m},{lat},{lng}'
    return f"""
[out:json][timeout:5];
(
  node["amenity"="veterinary"]({area});
  way["amenity"="veterinary"]({area});
  node["amenity"="animal_shelter"]({area});
  way["amenity"="animal_shelter"]({area});
  node["office"="veterinary"]({area});
  way["office"="veterinary"]({area});
  node["healthcare"="veterinary"]({area});
  way["healthcare"="veterinary"]({area});
  node["shop"="pet"]({area});
  way["shop"="pet"]({area});
  node["amenity"="animal_boarding"]({area});
  way["amenity"="animal_boarding"]({area});
  node["amenity"="cat_cafe"]({area});
  way["amenity"="cat_cafe"]({area});
  node["amenity"="cafe"]["cuisine"="cat_cafe"]({area});
  way["amenity"="cafe"]["cuisine"="cat_cafe"]({area});
  node["amenity"="cafe"]["cuisine"~"cat",i]({area});
  way["amenity"="cafe"]["cuisine"~"cat",i]({area});
  node["amenity"="cafe"]["animal"="cat"]({area});
  way["amenity"="cafe"]["animal"="cat"]({area});
  node["amenity"="cafe"]["pet"="cat"]({area});
  way["amenity"="cafe"]["pet"="cat"]({area});
  node["amenity"="cafe"]["theme"="cat"]({area});
  way["amenity"="cafe"]["theme"="cat"]({area});
  node["amenity"="cafe"]["theme"="cats"]({area});
  way["amenity"="cafe"]["theme"="cats"]({area});
  node["amenity"="cafe"]["name"~"cat.?caf|kattencaf|koci.*kawiarn|bar.*chat|katzencaf|cat.?lounge",i]({area});
  way["amenity"="cafe"]["name"~"cat.?caf|kattencaf|koci.*kawiarn|bar.*chat|katzencaf|cat.?lounge",i]({area});
);
out center 100;
""".strip()


def _fetch_overpass(query):
    """Send query to Overpass API and return parsed JSON with fast mirror fallback."""
    from urllib.parse import urlencode

    configured_url = getattr(settings, 'OVERPASS_API_URL', 'https://overpass.private.coffee/api/interpreter')
    urls_to_try = [configured_url]
    for mirror in OVERPASS_MIRRORS:
        if mirror not in urls_to_try:
            urls_to_try.append(mirror)

    data = urlencode({'data': query}).encode('utf-8')
    timeout = getattr(settings, 'OVERPASS_TIMEOUT_SECONDS', 2)

    last_error = None
    for url in urls_to_try:
        try:
            request = Request(url, data=data, method='POST')
            request.add_header('Content-Type', 'application/x-www-form-urlencoded')
            request.add_header('User-Agent', 'CatSOS/1.0 (lost-cat-recovery-app)')
            request.add_header('Accept', 'application/json')
            with urlopen(request, timeout=timeout) as response:
                return json.loads(response.read().decode('utf-8'))
        except (URLError, OSError, json.JSONDecodeError, ValueError) as exc:
            logger.warning('Overpass mirror %s failed: %s', url, exc)
            last_error = exc
            if configured_url != 'https://overpass.private.coffee/api/interpreter' and len(urls_to_try) == 1:
                raise exc

    if last_error:
        raise last_error
    raise URLError('All Overpass mirrors failed')


def _classify_element(tags):
    """Classify an element as vet, shelter, cat_cafe, or pet_help based on its tags."""
    amenity = tags.get('amenity', '')
    office = tags.get('office', '')
    healthcare = tags.get('healthcare', '')
    shop = tags.get('shop', '')
    cuisine = tags.get('cuisine', '').lower()
    animal = tags.get('animal', '').lower()
    pet = tags.get('pet', '').lower()
    theme = tags.get('theme', '').lower()
    raw_name = tags.get('name', '').lower()
    norm_name = (
        raw_name.replace('é', 'e')
        .replace('è', 'e')
        .replace('ê', 'e')
        .replace('ë', 'e')
        .replace('à', 'a')
        .replace('â', 'a')
    )

    is_cat_cafe_tag = (
        amenity == 'cat_cafe'
        or cuisine == 'cat_cafe'
        or 'cat_cafe' in cuisine
        or animal == 'cat'
        or pet == 'cat'
        or theme in ('cat', 'cats')
    )

    is_cat_cafe_name = (
        'cat cafe' in norm_name
        or 'cat-cafe' in norm_name
        or 'cat lounge' in norm_name
        or 'kattencafe' in norm_name
        or 'kawiarnia z kotami' in norm_name
        or 'kocia kawiarnia' in norm_name
        or 'cafe des chats' in norm_name
        or 'bar a chats' in norm_name
        or 'katzencafe' in norm_name
    )

    if is_cat_cafe_tag or (amenity == 'cafe' and ('cat' in cuisine or is_cat_cafe_name)) or is_cat_cafe_name:
        return 'cat_cafe'
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
    if center and center.get('lat') is not None and center.get('lon') is not None:
        return center.get('lat'), center.get('lon')
    bounds = element.get('bounds', {})
    if bounds:
        minlat, maxlat = bounds.get('minlat'), bounds.get('maxlat')
        minlon, maxlon = bounds.get('minlon'), bounds.get('maxlon')
        if minlat is not None and maxlat is not None and minlon is not None and maxlon is not None:
            return (minlat + maxlat) / 2.0, (minlon + maxlon) / 2.0
    geometry = element.get('geometry', [])
    if geometry:
        lats = [pt['lat'] for pt in geometry if 'lat' in pt and pt['lat'] is not None]
        lons = [pt['lon'] for pt in geometry if 'lon' in pt and pt['lon'] is not None]
        if lats and lons:
            return sum(lats) / len(lats), sum(lons) / len(lons)
    if element.get('lat') is not None and element.get('lon') is not None:
        return element.get('lat'), element.get('lon')
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
        'id': str(element.get('id')),
        'osm_id': element.get('id'),
        'osm_type': element.get('type'),
        'name': tags.get('name', ''),
        'type': category,
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
    """Sort: vets/shelters before cat_cafe before pet_help, then distance asc, then quality desc."""
    category_order = {'vet': 0, 'shelter': 0, 'cat_cafe': 1, 'pet_help': 2}

    return sorted(
        places,
        key=lambda p: (
            category_order.get(p['type'], 3),
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
