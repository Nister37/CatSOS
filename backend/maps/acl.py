from dataclasses import dataclass, field
import logging
import math
from typing import Any

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Coordinate:
    """Domain Value Object representing geographic coordinates."""
    latitude: float
    longitude: float

    def __post_init__(self):
        try:
            lat = float(self.latitude)
            lng = float(self.longitude)
        except (ValueError, TypeError) as exc:
            raise ValueError(f'Invalid coordinate numbers: lat={self.latitude}, lng={self.longitude}') from exc

        if not (-90.0 <= lat <= 90.0):
            raise ValueError(f'Latitude {lat} out of range [-90.0, 90.0]')
        if not (-180.0 <= lng <= 180.0):
            raise ValueError(f'Longitude {lng} out of range [-180.0, 180.0]')

        object.__setattr__(self, 'latitude', round(lat, 6))
        object.__setattr__(self, 'longitude', round(lng, 6))

    def distance_to(self, other: 'Coordinate') -> float:
        """Calculate great-circle distance to another coordinate in kilometers."""
        if not isinstance(other, Coordinate):
            raise TypeError(f'Expected Coordinate, got {type(other).__name__}')

        earth_radius_km = 6371.0
        lat1_r, lat2_r = math.radians(self.latitude), math.radians(other.latitude)
        dlat = math.radians(other.latitude - self.latitude)
        dlng = math.radians(other.longitude - self.longitude)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlng / 2) ** 2
        )
        a_clamped = min(1.0, max(0.0, a))
        return earth_radius_km * 2 * math.atan2(math.sqrt(a_clamped), math.sqrt(1 - a_clamped))

    def as_tuple(self) -> tuple[float, float]:
        return (self.latitude, self.longitude)

    def to_dict(self) -> dict[str, float]:
        return {'latitude': self.latitude, 'longitude': self.longitude}

    def __str__(self) -> str:
        return f'{self.latitude}, {self.longitude}'


@dataclass(frozen=True)
class Location:
    """Domain Value Object representing a physical location or point of interest."""
    coordinate: Coordinate
    name: str = ''
    street: str = ''
    house_number: str = ''
    city: str = ''
    postal_code: str = ''
    country: str = ''
    formatted_address: str = ''
    place_type: str = 'pet_help'
    osm_id: int | str | None = None
    osm_type: str = ''
    phone: str = ''
    website: str = ''
    opening_hours: str = ''
    quality_score: int = 0
    distance_km: float | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def display_address(self) -> str:
        parts: list[str] = []
        if self.street:
            street_part = self.street
            if self.house_number:
                street_part = f'{street_part} {self.house_number}'
            parts.append(street_part)
        if self.city:
            parts.append(self.city)
        if self.postal_code:
            parts.append(self.postal_code)
        if self.country:
            parts.append(self.country)

        if parts:
            return ', '.join(parts)
        return self.formatted_address or self.name

    def to_dict(self) -> dict[str, Any]:
        return {
            'coordinate': self.coordinate.to_dict(),
            'name': self.name,
            'street': self.street,
            'house_number': self.house_number,
            'city': self.city,
            'postal_code': self.postal_code,
            'country': self.country,
            'formatted_address': self.display_address,
            'place_type': self.place_type,
            'osm_id': self.osm_id,
            'osm_type': self.osm_type,
            'phone': self.phone,
            'website': self.website,
            'opening_hours': self.opening_hours,
            'quality_score': self.quality_score,
            'distance_km': round(self.distance_km, 2) if self.distance_km is not None else None,
            'metadata': dict(self.metadata),
        }


def _extract_element_coordinates(element: dict[str, Any]) -> tuple[float | None, float | None]:
    """Extract lat/lng from raw OpenStreetMap element dictionary."""
    if not isinstance(element, dict):
        return None, None

    if element.get('type') == 'node':
        lat = element.get('lat')
        lon = element.get('lon') if 'lon' in element else element.get('lng')
        if lat is not None and lon is not None:
            return float(lat), float(lon)

    center = element.get('center')
    if isinstance(center, dict):
        lat = center.get('lat')
        lon = center.get('lon') if 'lon' in center else center.get('lng')
        if lat is not None and lon is not None:
            return float(lat), float(lon)

    bounds = element.get('bounds')
    if isinstance(bounds, dict):
        minlat, maxlat = bounds.get('minlat'), bounds.get('maxlat')
        minlon, maxlon = (
            bounds.get('minlon', bounds.get('minlng')),
            bounds.get('maxlon', bounds.get('maxlng')),
        )
        if minlat is not None and maxlat is not None and minlon is not None and maxlon is not None:
            return (float(minlat) + float(maxlat)) / 2.0, (float(minlon) + float(maxlon)) / 2.0

    geometry = element.get('geometry')
    if isinstance(geometry, list) and geometry:
        lats = [float(pt['lat']) for pt in geometry if isinstance(pt, dict) and pt.get('lat') is not None]
        lons = [
            float(pt.get('lon', pt.get('lng')))
            for pt in geometry
            if isinstance(pt, dict) and (pt.get('lon') is not None or pt.get('lng') is not None)
        ]
        if lats and lons:
            return sum(lats) / len(lats), sum(lons) / len(lons)

    if element.get('lat') is not None and (element.get('lon') is not None or element.get('lng') is not None):
        return float(element['lat']), float(element.get('lon', element.get('lng')))

    return None, None


def _classify_osm_tags(tags: dict[str, Any]) -> str:
    """Classify place type from OSM tags."""
    if not isinstance(tags, dict):
        return 'pet_help'

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

    is_cat_cafe_name = any(
        kw in norm_name
        for kw in (
            'cat cafe', 'cat-cafe', 'cat lounge', 'kattencafe',
            'kawiarnia z kotami', 'kocia kawiarnia', 'cafe des chats',
            'bar a chats', 'katzencafe'
        )
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


def _compute_quality_score(tags: dict[str, Any]) -> int:
    """Compute data quality score based on richness of OSM tags."""
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


class MapsAntiCorruptionLayer:
    """
    Anti-Corruption Layer (ACL) for external OpenStreetMap and geocoding services.
    
    Translates raw Overpass QL elements, Nominatim search results, and external geocoders
    into clean, immutable internal `Coordinate` and `Location` domain value objects.
    """

    def extract_coordinate(self, raw: Any) -> Coordinate:
        """
        Extract and return a `Coordinate` domain value object from various external representations.
        Accepts:
          - Existing Coordinate
          - Tuple or list: (lat, lng)
          - Dict: {'lat': ..., 'lng': ...} or {'latitude': ..., 'longitude': ...}
          - OSM element or Geocoding result dict
        """
        if isinstance(raw, Coordinate):
            return raw

        if isinstance(raw, (tuple, list)) and len(raw) >= 2:
            return Coordinate(latitude=raw[0], longitude=raw[1])

        if isinstance(raw, dict):
            if 'latitude' in raw and 'longitude' in raw:
                return Coordinate(latitude=raw['latitude'], longitude=raw['longitude'])
            if 'lat' in raw and ('lon' in raw or 'lng' in raw):
                return Coordinate(latitude=raw['lat'], longitude=raw.get('lon', raw.get('lng')))

            # Check if it's an OSM element with node / center / bounds
            lat, lon = _extract_element_coordinates(raw)
            if lat is not None and lon is not None:
                return Coordinate(latitude=lat, longitude=lon)

        raise ValueError(f'Cannot extract valid Coordinate from {raw!r}')

    def translate_osm_element(
        self,
        element: dict[str, Any],
        origin: Coordinate | None = None,
    ) -> Location | None:
        """
        Translate an OpenStreetMap / Overpass element dict into a `Location` domain value object.
        """
        if not isinstance(element, dict):
            return None

        lat, lon = _extract_element_coordinates(element)
        if lat is None or lon is None:
            return None

        try:
            coordinate = Coordinate(latitude=lat, longitude=lon)
        except ValueError:
            return None

        tags: dict[str, Any] = element.get('tags', {})
        place_type = _classify_osm_tags(tags)
        quality = _compute_quality_score(tags)

        phone = str(tags.get('phone') or tags.get('contact:phone') or '').strip()
        website = str(tags.get('website') or tags.get('contact:website') or '').strip()
        opening_hours = str(tags.get('opening_hours') or '').strip()

        street = str(tags.get('addr:street') or '').strip()
        house_number = str(tags.get('addr:housenumber') or '').strip()
        city = str(tags.get('addr:city') or '').strip()
        postal_code = str(tags.get('addr:postcode') or '').strip()
        country = str(tags.get('addr:country') or '').strip()
        name = str(tags.get('name') or '').strip()

        distance = None
        if origin is not None:
            try:
                origin_coord = self.extract_coordinate(origin)
                distance = origin_coord.distance_to(coordinate)
            except (ValueError, TypeError):
                pass

        return Location(
            coordinate=coordinate,
            name=name,
            street=street,
            house_number=house_number,
            city=city,
            postal_code=postal_code,
            country=country,
            formatted_address='',
            place_type=place_type,
            osm_id=element.get('id'),
            osm_type=str(element.get('type') or ''),
            phone=phone,
            website=website,
            opening_hours=opening_hours,
            quality_score=quality,
            distance_km=distance,
            metadata={'tags': tags},
        )

    def translate_geocoding_result(
        self,
        result: dict[str, Any],
        origin: Coordinate | None = None,
    ) -> Location | None:
        """
        Translate an external Nominatim / geocoding API result into a `Location` domain value object.
        """
        if not isinstance(result, dict):
            return None

        lat = result.get('lat')
        lon = result.get('lon') or result.get('lng')
        if lat is None or lon is None:
            return None

        try:
            coordinate = Coordinate(latitude=lat, longitude=lon)
        except (ValueError, TypeError):
            return None

        address = result.get('address', {}) if isinstance(result.get('address'), dict) else {}
        display_name = str(result.get('display_name') or '').strip()
        name = str(
            result.get('name')
            or address.get('amenity')
            or address.get('building')
            or (display_name.split(',')[0] if display_name else '')
        ).strip()

        street = str(
            address.get('road')
            or address.get('street')
            or address.get('pedestrian')
            or address.get('footway')
            or ''
        ).strip()
        house_number = str(address.get('house_number') or address.get('housenumber') or '').strip()
        city = str(
            address.get('city')
            or address.get('town')
            or address.get('village')
            or address.get('municipality')
            or address.get('county')
            or ''
        ).strip()
        postal_code = str(address.get('postcode') or address.get('postal_code') or '').strip()
        country = str(address.get('country') or '').strip()

        place_type = str(result.get('type') or result.get('class') or 'pet_help').strip()
        if place_type in ('veterinary', 'vet'):
            place_type = 'vet'
        elif place_type in ('animal_shelter', 'shelter'):
            place_type = 'shelter'

        distance = None
        if origin is not None:
            try:
                origin_coord = self.extract_coordinate(origin)
                distance = origin_coord.distance_to(coordinate)
            except (ValueError, TypeError):
                pass

        return Location(
            coordinate=coordinate,
            name=name,
            street=street,
            house_number=house_number,
            city=city,
            postal_code=postal_code,
            country=country,
            formatted_address=display_name,
            place_type=place_type,
            osm_id=result.get('osm_id') or result.get('place_id'),
            osm_type=str(result.get('osm_type') or ''),
            phone='',
            website='',
            opening_hours='',
            quality_score=1 if display_name else 0,
            distance_km=distance,
            metadata={'raw_address': address},
        )

    def translate_places(
        self,
        elements: list[dict[str, Any]],
        origin: Coordinate | None = None,
    ) -> list[Location]:
        """Translate a collection of OSM elements into a deduplicated list of `Location` domain objects."""
        if not elements:
            return []

        locations: list[Location] = []
        seen: set[tuple[str, Any]] = set()

        for el in elements:
            loc = self.translate_osm_element(el, origin=origin)
            if loc is not None:
                key = (loc.osm_type, loc.osm_id)
                if key != ('', None) and key in seen:
                    continue
                seen.add(key)
                locations.append(loc)

        return locations


# Module-level convenience functions
_default_maps_acl = MapsAntiCorruptionLayer()

extract_coordinate = _default_maps_acl.extract_coordinate
translate_osm_element = _default_maps_acl.translate_osm_element
translate_geocoding_result = _default_maps_acl.translate_geocoding_result
translate_places = _default_maps_acl.translate_places
