import ipaddress
import json
import logging
import math
import re
from urllib.error import URLError
from urllib.request import Request, urlopen

from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from notifications.services import (
    enqueue_sighting_created_notification,
)
from points.services import (
    award_sighting_submitted_points,
    award_volunteer_search_started_points,
)
from reports.events import SightingVerifiedEvent, publish_domain_event
from reports.models import LostCatReport, LostCatReportTimelineEvent

from .models import Sighting, SightingPhoto, VolunteerSearch

logger = logging.getLogger(__name__)

ACTIVE_SEARCH_STATUSES = (
    LostCatReport.Status.MISSING,
    LostCatReport.Status.RECENTLY_SEEN,
)

MAX_TRENDING_RADIUS_KM = 100.0


def build_sighting_location_summary(sighting):
    if sighting.location_description:
        return sighting.location_description
    return f'{sighting.latitude:.3f}, {sighting.longitude:.3f}'


@transaction.atomic
def create_sighting(*, report, submitted_by, validated_data, photo=None):
    sighting = Sighting.objects.create(
        report=report,
        submitted_by=submitted_by,
        **validated_data,
    )
    if photo is not None:
        SightingPhoto.objects.create(
            sighting=sighting,
            uploaded_by=submitted_by,
            image=photo,
        )
    LostCatReportTimelineEvent.objects.create(
        report=report,
        actor=submitted_by,
        event_type=LostCatReportTimelineEvent.EventType.SIGHTING_CREATED,
        location_summary=build_sighting_location_summary(sighting),
    )
    award_sighting_submitted_points(sighting=sighting)
    enqueue_sighting_created_notification(sighting=sighting)
    return sighting


def build_report_location_summary(report):
    if report.last_seen_landmark:
        return report.last_seen_landmark
    if report.last_seen_lat is not None and report.last_seen_lng is not None:
        return f'{report.last_seen_lat:.3f}, {report.last_seen_lng:.3f}'
    return ''


@transaction.atomic
def mark_volunteer_searching(*, report, volunteer):
    volunteer_search, created = VolunteerSearch.objects.get_or_create(
        report=report,
        volunteer=volunteer,
    )
    if created:
        LostCatReportTimelineEvent.objects.create(
            report=report,
            actor=volunteer,
            event_type=LostCatReportTimelineEvent.EventType.VOLUNTEER_SEARCH_STARTED,
            location_summary=build_report_location_summary(report),
        )
        award_volunteer_search_started_points(volunteer_search=volunteer_search)
    else:
        volunteer_search.save(update_fields=('updated_at',))

    return volunteer_search, created


@transaction.atomic
def update_sighting_verification(*, sighting, actor, verification_status):
    previous_status = sighting.verification_status
    sighting.verification_status = verification_status
    update_fields = {'verification_status', 'updated_at'}

    if verification_status == Sighting.VerificationStatus.PENDING:
        sighting.verified_by = None
        sighting.verified_at = None
    else:
        sighting.verified_by = actor
        sighting.verified_at = timezone.now()
    update_fields.update({'verified_by', 'verified_at'})

    sighting.save(update_fields=tuple(update_fields))
    if previous_status != verification_status:
        event_type_by_status = {
            Sighting.VerificationStatus.USEFUL: (
                LostCatReportTimelineEvent.EventType.SIGHTING_MARKED_USEFUL
            ),
            Sighting.VerificationStatus.FALSE: (
                LostCatReportTimelineEvent.EventType.SIGHTING_MARKED_FALSE
            ),
        }
        event_type = event_type_by_status.get(verification_status)
        if event_type is not None:
            LostCatReportTimelineEvent.objects.create(
                report=sighting.report,
                actor=actor,
                event_type=event_type,
                location_summary=build_sighting_location_summary(sighting),
            )
        publish_domain_event(
            SightingVerifiedEvent(
                sighting_id=str(sighting.pk),
                sighting=sighting,
                report_id=str(sighting.report_id),
                actor=actor,
                verification_status=verification_status,
                previous_status=previous_status,
                location_summary=build_sighting_location_summary(sighting),
            )
        )
    return sighting


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate the great-circle distance between two points in km."""
    radius_earth_km = 6371.0
    lat1_r, lat2_r = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlng / 2) ** 2
    )
    a_clamped = min(1.0, max(0.0, a))
    return radius_earth_km * 2 * math.atan2(math.sqrt(a_clamped), math.sqrt(1 - a_clamped))


def is_public_ip(ip_str: str) -> bool:
    """Return True if the IP string is a valid non-private, non-loopback IP."""
    if not ip_str or not isinstance(ip_str, str):
        return False
    try:
        ip = ipaddress.ip_address(ip_str.strip())
        return not (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        )
    except Exception:
        return False


def resolve_ip_location(ip_str: str) -> tuple[float, float, str] | None:
    """Resolve an IP address to (lat, lng, city_name) using cache and fast geolocation providers."""
    if not is_public_ip(ip_str):
        return None

    cleaned_ip = ip_str.strip()
    cache_key = f'geo_ip_loc_{cleaned_ip}'
    cached = cache.get(cache_key)
    if cached and isinstance(cached, dict):
        return (cached['lat'], cached['lng'], cached.get('city', ''))

    endpoints = [
        f'http://ip-api.com/json/{cleaned_ip}?fields=status,lat,lon,city',
        f'https://ipapi.co/{cleaned_ip}/json/',
    ]

    for url in endpoints:
        try:
            req = Request(url, headers={'User-Agent': 'CatSOS-App/1.0'})
            with urlopen(req, timeout=1.5) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                lat = data.get('lat') or data.get('latitude')
                lon = data.get('lon') or data.get('longitude')
                city = data.get('city', '') or ''
                if lat is not None and lon is not None:
                    lat_f, lon_f = float(lat), float(lon)
                    cache.set(
                        cache_key,
                        {'lat': lat_f, 'lng': lon_f, 'city': city},
                        timeout=86400,
                    )
                    return (lat_f, lon_f, city)
        except (URLError, TimeoutError, Exception) as exc:
            logger.debug('IP geolocation lookup failed for %s at %s: %s', cleaned_ip, url, exc)

    return None


COUNTRY_NAMES = {
    'poland', 'polska', 'united states', 'usa', 'us', 'uk', 'united kingdom',
    'france', 'germany', 'deutschland', 'netherlands', 'nederland', 'belgium',
    'belgique', 'belgië', 'canada', 'spain', 'españa', 'italy', 'italia',
}


def _is_postal_or_country(token: str) -> bool:
    t = token.strip().lower()
    if t in COUNTRY_NAMES:
        return True
    if re.match(r'^\d{2,5}(-\d{3,4})?$', t) or re.match(r'^[a-z0-9]{2,4}\s?[a-z0-9]{2,4}$', t):
        if any(c.isdigit() for c in t):
            return True
    return False


def _strip_house_number(text: str) -> str:
    s = re.sub(r'^\d+[a-zA-Z]?\s+', '', text).strip()
    s = re.sub(r'\s+\d+[a-zA-Z]?$', '', s).strip()
    return s or text


def extract_area_label(address: str, landmark: str = '') -> str:
    """Extract a user-friendly neighborhood/city/area name from an address and optional landmark."""
    addr = (address or '').strip()
    lm = (landmark or '').strip()
    if not addr:
        return lm or 'Nearby area'

    parts = [p.strip() for p in addr.split(',') if p.strip()]

    # Strip trailing country names or postal codes
    while len(parts) > 1 and _is_postal_or_country(parts[-1]):
        parts.pop()

    if len(parts) >= 3:
        # e.g. ["12 Maple Street", "Brooklyn", "NY"] -> "Brooklyn, NY"
        return ', '.join(parts[1:])
    elif len(parts) == 2:
        # e.g. ["Centrum", "Warsaw"] or ["10 Main St", "Austin"]
        first = parts[0].lower()
        if (
            any(first.startswith(p) for p in ('ul.', 'al.', 'pl.', 'street', 'st.', 'ave', 'via', 'rue', 'road', 'rd.'))
            or any(c.isdigit() for c in parts[0])
        ):
            return parts[1]
        return ', '.join(parts)
    else:
        # Single token: protect privacy by avoiding exact house numbers
        single = parts[0]
        if lm:
            return lm
        return _strip_house_number(single)


def get_trending_nearby(
    *,
    user_lat: float | None = None,
    user_lng: float | None = None,
    ip: str | None = None,
    radius_km: float = MAX_TRENDING_RADIUS_KM,
) -> dict:
    """
    Find genuine trending areas/neighborhoods/cities nearby (<= 100km)
    based on active lost cat reports and recent active sightings.
    If no user location can be determined or no reports exist within radius, returns an empty list.
    """
    effective_radius = min(float(radius_km if radius_km is not None else MAX_TRENDING_RADIUS_KM), MAX_TRENDING_RADIUS_KM)
    if effective_radius <= 0:
        effective_radius = MAX_TRENDING_RADIUS_KM

    lat_val: float | None = None
    lng_val: float | None = None
    city_name: str = ''
    source: str | None = None

    if user_lat is not None and user_lng is not None:
        try:
            lat_val = float(user_lat)
            lng_val = float(user_lng)
            source = 'coordinates'
        except (TypeError, ValueError):
            lat_val = None
            lng_val = None

    if (lat_val is None or lng_val is None) and ip:
        ip_result = resolve_ip_location(ip)
        if ip_result:
            lat_val, lng_val, city_name = ip_result
            source = 'ip'

    # If coordinates still cannot be resolved, return honest empty state
    if lat_val is None or lng_val is None:
        return {
            'trends': [],
            'count': 0,
            'user_location': None,
            'radius_km': effective_radius,
        }

    # Bounding box pre-filtering for database efficiency
    d_lat = effective_radius / 110.0
    cos_lat = max(0.01, math.cos(math.radians(lat_val)))
    d_lng = effective_radius / (110.0 * cos_lat)
    min_lat, max_lat = lat_val - d_lat, lat_val + d_lat
    min_lng, max_lng = lng_val - d_lng, lng_val + d_lng

    # 1. Active reports within bounding box
    active_reports = (
        LostCatReport.objects.filter(
            status__in=ACTIVE_SEARCH_STATUSES,
            last_seen_lat__isnull=False,
            last_seen_lng__isnull=False,
            last_seen_lat__gte=min_lat,
            last_seen_lat__lte=max_lat,
            last_seen_lng__gte=min_lng,
            last_seen_lng__lte=max_lng,
        )
        .exclude(moderation_status=LostCatReport.ModerationStatus.HIDDEN)
        .only('id', 'cat_name', 'last_seen_address', 'last_seen_landmark', 'last_seen_lat', 'last_seen_lng')
    )

    # 2. Sightings for active reports within bounding box
    active_sightings = (
        Sighting.objects.filter(
            latitude__isnull=False,
            longitude__isnull=False,
            latitude__gte=min_lat,
            latitude__lte=max_lat,
            longitude__gte=min_lng,
            longitude__lte=max_lng,
            report__status__in=ACTIVE_SEARCH_STATUSES,
        )
        .exclude(report__moderation_status=LostCatReport.ModerationStatus.HIDDEN)
        .exclude(verification_status=Sighting.VerificationStatus.FALSE)
        .select_related('report')
        .only('id', 'location_description', 'latitude', 'longitude', 'report__last_seen_address', 'report__last_seen_landmark')
    )

    # Gather points strictly within haversine distance
    points: list[dict] = []

    for rep in active_reports:
        dist = haversine_km(lat_val, lng_val, rep.last_seen_lat, rep.last_seen_lng)
        if dist <= effective_radius:
            points.append({
                'lat': rep.last_seen_lat,
                'lng': rep.last_seen_lng,
                'address': rep.last_seen_address,
                'landmark': rep.last_seen_landmark,
                'distance': dist,
                'item_type': 'report',
            })

    for stg in active_sightings:
        dist = haversine_km(lat_val, lng_val, stg.latitude, stg.longitude)
        if dist <= effective_radius:
            address = stg.location_description or (stg.report.last_seen_address if stg.report else '')
            landmark = stg.report.last_seen_landmark if stg.report else ''
            points.append({
                'lat': stg.latitude,
                'lng': stg.longitude,
                'address': address,
                'landmark': landmark,
                'distance': dist,
                'item_type': 'sighting',
            })

    if not points:
        return {
            'trends': [],
            'count': 0,
            'user_location': {
                'lat': round(lat_val, 4),
                'lng': round(lng_val, 4),
                'source': source,
                'city': city_name,
            },
            'radius_km': effective_radius,
        }

    # Cluster points by extracted area name and spatial proximity (<= 5 km)
    clusters: list[dict] = []
    # Sort points by proximity to user so the closest clusters form first
    points.sort(key=lambda p: p['distance'])

    for pt in points:
        pt_label = extract_area_label(pt['address'], pt['landmark'])
        norm_key = pt_label.lower().strip()

        matched_cluster = None
        for c in clusters:
            dist_to_cluster = haversine_km(pt['lat'], pt['lng'], c['center_lat'], c['center_lng'])
            # Merge if physically within 5km, or matching normalized label within 10km
            if dist_to_cluster <= 5.0 or (c['norm_key'] == norm_key and dist_to_cluster <= 10.0):
                matched_cluster = c
                break

        if matched_cluster:
            matched_cluster['count'] += 1
            total = matched_cluster['count']
            matched_cluster['center_lat'] = (matched_cluster['center_lat'] * (total - 1) + pt['lat']) / total
            matched_cluster['center_lng'] = (matched_cluster['center_lng'] * (total - 1) + pt['lng']) / total
            # Track label frequencies to pick the most canonical area name
            label_map = matched_cluster['label_counts']
            label_map[pt_label] = label_map.get(pt_label, 0) + 1
            best_label = max(label_map.keys(), key=lambda k: (label_map[k], -len(k)))
            matched_cluster['label'] = best_label
            matched_cluster['query'] = best_label
        else:
            clusters.append({
                'label': pt_label,
                'query': pt_label,
                'norm_key': norm_key,
                'count': 1,
                'center_lat': pt['lat'],
                'center_lng': pt['lng'],
                'label_counts': {pt_label: 1},
            })

    # Calculate distance from user to cluster center
    for c in clusters:
        c['distance_km'] = round(haversine_km(lat_val, lng_val, c['center_lat'], c['center_lng']), 1)

    # Order clusters: most active sightings first, then closest distance
    clusters.sort(key=lambda c: (-c['count'], c['distance_km']))

    top_clusters = clusters[:8]
    formatted_trends = [
        {
            'id': f'trend-{idx}',
            'label': c['label'],
            'query': c['query'],
            'count': c['count'],
            'distance_km': c['distance_km'],
            'lat': round(c['center_lat'], 5),
            'lng': round(c['center_lng'], 5),
        }
        for idx, c in enumerate(top_clusters)
    ]

    return {
        'trends': formatted_trends,
        'count': len(formatted_trends),
        'user_location': {
            'lat': round(lat_val, 4),
            'lng': round(lng_val, 4),
            'source': source,
            'city': city_name,
        },
        'radius_km': effective_radius,
    }

