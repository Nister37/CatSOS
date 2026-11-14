from dataclasses import asdict, dataclass, field
from datetime import datetime
import json
import logging
from typing import Any
from uuid import UUID

logger = logging.getLogger(__name__)

CONTRACT_VERSION_V1 = 'v1'

VALID_GENDERS = {'FEMALE', 'MALE', 'UNKNOWN'}
VALID_STATUSES = {'ACTIVE', 'RESOLVED', 'CLOSED', 'MISSING', 'RECENTLY_SEEN', 'FOUND'}


class ContractValidationError(Exception):
    """Raised when a Published Language contract payload fails validation."""
    def __init__(self, errors: list[str] | dict[str, Any]):
        self.errors = errors
        message = '; '.join(errors) if isinstance(errors, list) else str(errors)
        super().__init__(f'Contract validation failed: {message}')


def _to_bool(value: Any, default: bool = False) -> bool:
    """Safely convert loose JSON types or strings ('false', '0', 'no') into boolean."""
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        norm = value.strip().lower()
        if norm in ('true', '1', 'yes', 't', 'y'):
            return True
        if norm in ('false', '0', 'no', 'f', 'n', ''):
            return False
    return bool(value)


@dataclass(frozen=True)
class AnimalDetailsV1:
    name: str
    species: str = 'cat'
    breed: str = ''
    coat_color: str = ''
    eye_color: str = ''
    gender: str = 'UNKNOWN'
    age_years: int | None = None
    has_microchip: bool = False
    chip_number: str = ''
    collar_description: str = ''
    distinguishing_features: str = ''

    def __post_init__(self):
        norm_gender = (self.gender or 'UNKNOWN').upper().strip()
        if norm_gender not in VALID_GENDERS:
            norm_gender = 'UNKNOWN'
        object.__setattr__(self, 'gender', norm_gender)
        object.__setattr__(self, 'name', str(self.name or '').strip())
        object.__setattr__(self, 'species', str(self.species or 'cat').strip().lower())
        object.__setattr__(self, 'has_microchip', _to_bool(self.has_microchip, False))
        if self.age_years is not None:
            try:
                object.__setattr__(self, 'age_years', int(self.age_years))
            except (ValueError, TypeError):
                object.__setattr__(self, 'age_years', None)


@dataclass(frozen=True)
class LocationDetailsV1:
    address: str
    landmark: str = ''
    latitude: float | None = None
    longitude: float | None = None

    def __post_init__(self):
        if self.latitude is not None and not (isinstance(self.latitude, str) and not self.latitude.strip()):
            if isinstance(self.latitude, bool):
                raise ValueError('Latitude cannot be boolean')
            lat = float(self.latitude)
            if not (-90.0 <= lat <= 90.0):
                raise ValueError(f'Latitude {lat} out of range [-90.0, 90.0]')
            object.__setattr__(self, 'latitude', round(lat, 6))
        else:
            object.__setattr__(self, 'latitude', None)

        if self.longitude is not None and not (isinstance(self.longitude, str) and not self.longitude.strip()):
            if isinstance(self.longitude, bool):
                raise ValueError('Longitude cannot be boolean')
            lng = float(self.longitude)
            if not (-180.0 <= lng <= 180.0):
                raise ValueError(f'Longitude {lng} out of range [-180.0, 180.0]')
            object.__setattr__(self, 'longitude', round(lng, 6))
        else:
            object.__setattr__(self, 'longitude', None)


@dataclass(frozen=True)
class ContactDetailsV1:
    authorized_for_shelters: bool = True
    contact_name: str = ''
    contact_phone: str = ''
    contact_email: str = ''

    def __post_init__(self):
        object.__setattr__(self, 'authorized_for_shelters', _to_bool(self.authorized_for_shelters, True))


@dataclass(frozen=True)
class RewardDetailsV1:
    offered: bool = False
    amount: float | None = None
    currency: str = 'EUR'
    note: str = ''

    def __post_init__(self):
        object.__setattr__(self, 'offered', _to_bool(self.offered, False))
        if self.amount is not None:
            try:
                object.__setattr__(self, 'amount', round(float(self.amount), 2))
            except (ValueError, TypeError):
                object.__setattr__(self, 'amount', None)


@dataclass(frozen=True)
class PetIncidentContractV1:
    """
    Published Language (PL) contract version 1 for lost/found pet incident reports.
    
    Provides an explicit, stable schema boundary decoupling external consumers
    (shelters, veterinary clinics, partner rescue registries) from CatSOS internal models.
    """
    schema_version: str
    incident_id: str
    incident_type: str  # 'LOST' or 'FOUND'
    status: str         # 'ACTIVE', 'RESOLVED', 'CLOSED'
    animal: AnimalDetailsV1
    location: LocationDetailsV1
    summary: str
    description: str
    reported_at: str    # ISO 8601
    disappeared_at: str | None = None
    resolved_at: str | None = None
    photos: tuple[str, ...] = ()
    reward: RewardDetailsV1 = field(default_factory=RewardDetailsV1)
    contact: ContactDetailsV1 = field(default_factory=ContactDetailsV1)
    source_system: str = 'CatSOS'
    public_url: str = ''

    def to_dict(self) -> dict[str, Any]:
        return {
            'schema_version': self.schema_version,
            'incident_id': self.incident_id,
            'incident_type': self.incident_type,
            'status': self.status,
            'animal': asdict(self.animal),
            'location': asdict(self.location),
            'summary': self.summary,
            'description': self.description,
            'reported_at': self.reported_at,
            'disappeared_at': self.disappeared_at,
            'resolved_at': self.resolved_at,
            'photos': list(self.photos),
            'reward': asdict(self.reward),
            'contact': asdict(self.contact),
            'source_system': self.source_system,
            'public_url': self.public_url,
        }

    def to_json(self, indent: int | None = None) -> str:
        return json.dumps(self.to_dict(), indent=indent, default=str)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> 'PetIncidentContractV1':
        errors = validate_pet_incident_payload(data)
        if errors:
            raise ContractValidationError(errors)

        animal_raw = data.get('animal') or {}
        animal = AnimalDetailsV1(
            name=animal_raw.get('name', ''),
            species=animal_raw.get('species', 'cat'),
            breed=animal_raw.get('breed', ''),
            coat_color=animal_raw.get('coat_color', ''),
            eye_color=animal_raw.get('eye_color', ''),
            gender=animal_raw.get('gender', 'UNKNOWN'),
            age_years=animal_raw.get('age_years'),
            has_microchip=_to_bool(animal_raw.get('has_microchip', False), False),
            chip_number=str(animal_raw.get('chip_number') or ''),
            collar_description=animal_raw.get('collar_description', ''),
            distinguishing_features=animal_raw.get('distinguishing_features', ''),
        )

        loc_raw = data.get('location') or {}
        location = LocationDetailsV1(
            address=loc_raw.get('address', ''),
            landmark=loc_raw.get('landmark', ''),
            latitude=loc_raw.get('latitude'),
            longitude=loc_raw.get('longitude'),
        )

        contact_raw = data.get('contact') or {}
        contact = ContactDetailsV1(
            authorized_for_shelters=_to_bool(contact_raw.get('authorized_for_shelters', True), True),
            contact_name=contact_raw.get('contact_name', ''),
            contact_phone=contact_raw.get('contact_phone', ''),
            contact_email=contact_raw.get('contact_email', ''),
        )

        reward_raw = data.get('reward') or {}
        raw_amt = reward_raw.get('amount')
        parsed_amt = None
        if raw_amt is not None and str(raw_amt).strip():
            try:
                parsed_amt = round(float(raw_amt), 2)
            except (ValueError, TypeError):
                parsed_amt = None

        reward = RewardDetailsV1(
            offered=_to_bool(reward_raw.get('offered', False), False),
            amount=parsed_amt,
            currency=reward_raw.get('currency', 'EUR'),
            note=reward_raw.get('note', ''),
        )

        photos_raw = data.get('photos') or []
        photos = tuple(str(p) for p in photos_raw if p)

        return cls(
            schema_version=data.get('schema_version', CONTRACT_VERSION_V1),
            incident_id=str(data.get('incident_id')),
            incident_type=str(data.get('incident_type', 'LOST')).upper(),
            status=str(data.get('status', 'ACTIVE')).upper(),
            animal=animal,
            location=location,
            summary=str(data.get('summary', '')),
            description=str(data.get('description', '')),
            reported_at=str(data.get('reported_at', '')),
            disappeared_at=data.get('disappeared_at'),
            resolved_at=data.get('resolved_at'),
            photos=photos,
            reward=reward,
            contact=contact,
            source_system=str(data.get('source_system', 'CatSOS')),
            public_url=str(data.get('public_url', '')),
        )

    @classmethod
    def from_json(cls, json_str: str) -> 'PetIncidentContractV1':
        try:
            data = json.loads(json_str)
        except json.JSONDecodeError as exc:
            raise ContractValidationError([f'Invalid JSON: {exc}']) from exc
        return cls.from_dict(data)

    @classmethod
    def from_report(cls, report: Any, base_url: str = '') -> 'PetIncidentContractV1':
        """
        Build a PetIncidentContractV1 directly from a CatSOS LostCatReport model instance.
        Isolates internal ORM details and maps them into the Published Language.
        """
        # Determine external status
        if getattr(report, 'status', None) in ('FOUND',):
            ext_status = 'RESOLVED'
        elif getattr(report, 'status', None) in ('CLOSED',):
            ext_status = 'CLOSED'
        else:
            ext_status = 'ACTIVE'

        # Photo URLs
        photo_urls: list[str] = []
        if hasattr(report, 'photos'):
            for p in report.photos.all():
                if getattr(p, 'image', None):
                    url = p.image.url
                    if base_url and not url.startswith('http'):
                        url = f"{base_url.rstrip('/')}/{url.lstrip('/')}"
                    photo_urls.append(url)

        animal = AnimalDetailsV1(
            name=getattr(report, 'cat_name', ''),
            species='cat',
            breed=getattr(report, 'breed', ''),
            coat_color=getattr(report, 'coat_color', ''),
            eye_color=getattr(report, 'eye_color', ''),
            gender=getattr(report, 'gender', 'UNKNOWN'),
            age_years=getattr(report, 'age_years', None),
            has_microchip=bool(getattr(report, 'has_microchip', False)),
            chip_number=getattr(report, 'chip_number', ''),
            collar_description=getattr(report, 'collar_description', ''),
            distinguishing_features=getattr(report, 'personality', ''),
        )

        location = LocationDetailsV1(
            address=getattr(report, 'last_seen_address', ''),
            landmark=getattr(report, 'last_seen_landmark', ''),
            latitude=getattr(report, 'last_seen_lat', None),
            longitude=getattr(report, 'last_seen_lng', None),
        )

        reward_amount = getattr(report, 'reward_amount', None)
        reward = RewardDetailsV1(
            offered=bool(reward_amount),
            amount=float(reward_amount) if reward_amount else None,
            currency='EUR',
            note=getattr(report, 'reward_note', ''),
        )

        # Contact sharing for shelters
        contact = ContactDetailsV1(
            authorized_for_shelters=True,
            contact_name=getattr(report, 'contact_name', ''),
            contact_phone=getattr(report, 'contact_phone', ''),
            contact_email=getattr(report, 'contact_email', ''),
        )

        public_id = getattr(report, 'public_id', getattr(report, 'id', ''))
        public_url = f"{base_url.rstrip('/')}/reports/{public_id}" if base_url else f"/reports/{public_id}"

        reported_at = getattr(report, 'created_at', None)
        reported_at_str = reported_at.isoformat() if hasattr(reported_at, 'isoformat') else str(reported_at or '')

        disappeared_at = getattr(report, 'disappeared_at', None)
        disappeared_at_str = (
            disappeared_at.isoformat() if hasattr(disappeared_at, 'isoformat') else (str(disappeared_at) if disappeared_at else None)
        )

        resolved_at = getattr(report, 'resolved_at', None)
        resolved_at_str = (
            resolved_at.isoformat() if hasattr(resolved_at, 'isoformat') else (str(resolved_at) if resolved_at else None)
        )

        return cls(
            schema_version=CONTRACT_VERSION_V1,
            incident_id=str(public_id),
            incident_type='LOST',
            status=ext_status,
            animal=animal,
            location=location,
            summary=getattr(report, 'public_summary', ''),
            description=getattr(report, 'description', ''),
            reported_at=reported_at_str,
            disappeared_at=disappeared_at_str,
            resolved_at=resolved_at_str,
            photos=tuple(photo_urls),
            reward=reward,
            contact=contact,
            source_system='CatSOS',
            public_url=public_url,
        )


def validate_pet_incident_payload(data: Any) -> list[str]:
    """
    Validate an interchange dictionary payload against PetIncidentContractV1 rules.
    Returns a list of validation error messages (empty list if valid).
    """
    errors: list[str] = []

    if not isinstance(data, dict):
        return ['Contract payload must be a JSON object (dictionary)']

    schema_version = data.get('schema_version')
    if schema_version != CONTRACT_VERSION_V1:
        errors.append(f"Unsupported schema_version '{schema_version}'; expected '{CONTRACT_VERSION_V1}'")

    incident_id = data.get('incident_id')
    if not incident_id:
        errors.append("Field 'incident_id' is required")
    else:
        try:
            UUID(str(incident_id))
        except (ValueError, AttributeError):
            # Non-UUID string allowed if non-empty, but flag if whitespace
            if not str(incident_id).strip():
                errors.append("Field 'incident_id' must not be blank")

    # Animal validation
    animal = data.get('animal')
    if not isinstance(animal, dict):
        errors.append("Field 'animal' must be an object")
    else:
        if not animal.get('name') and not data.get('description'):
            errors.append("At least 'animal.name' or 'description' must be provided")

        gender = animal.get('gender')
        if gender and str(gender).upper().strip() not in VALID_GENDERS:
            errors.append(f"Invalid gender '{gender}'. Must be one of {sorted(VALID_GENDERS)}")

        age = animal.get('age_years')
        if age is not None:
            try:
                age_int = int(age)
                if age_int < 0 or age_int > 40:
                    errors.append(f"Invalid 'age_years' {age}; expected 0 to 40")
            except (ValueError, TypeError):
                errors.append(f"'age_years' must be an integer, got {age}")

    # Location validation
    location = data.get('location')
    if not isinstance(location, dict):
        errors.append("Field 'location' must be an object")
    else:
        lat = location.get('latitude')
        if lat is not None:
            try:
                lat_f = float(lat)
                if not (-90.0 <= lat_f <= 90.0):
                    errors.append(f"Latitude {lat_f} must be between -90 and 90")
            except (ValueError, TypeError):
                errors.append(f"Latitude must be a valid float, got {lat}")

        lng = location.get('longitude')
        if lng is not None:
            try:
                lng_f = float(lng)
                if not (-180.0 <= lng_f <= 180.0):
                    errors.append(f"Longitude {lng_f} must be between -180 and 180")
            except (ValueError, TypeError):
                errors.append(f"Longitude must be a valid float, got {lng}")

    # Status validation
    status = data.get('status')
    if status and str(status).upper().strip() not in VALID_STATUSES:
        errors.append(f"Invalid status '{status}'. Must be one of {sorted(VALID_STATUSES)}")

    reward = data.get('reward')
    if reward is not None and not isinstance(reward, dict):
        errors.append("Field 'reward' must be an object if provided")

    contact = data.get('contact')
    if contact is not None and not isinstance(contact, dict):
        errors.append("Field 'contact' must be an object if provided")

    photos = data.get('photos')
    if photos is not None and not isinstance(photos, (list, tuple)):
        errors.append("Field 'photos' must be a list if provided")

    return errors


def serialize_pet_incident_v1(instance: PetIncidentContractV1 | Any, base_url: str = '') -> dict[str, Any]:
    """Helper to serialize either a PetIncidentContractV1 or a LostCatReport model into a clean interchange dict."""
    if isinstance(instance, PetIncidentContractV1):
        return instance.to_dict()
    return PetIncidentContractV1.from_report(instance, base_url=base_url).to_dict()


def deserialize_pet_incident_v1(payload: dict[str, Any] | str, validate: bool = True) -> PetIncidentContractV1:
    """Helper to parse a dict or JSON string into PetIncidentContractV1, with validation."""
    if isinstance(payload, str):
        return PetIncidentContractV1.from_json(payload)
    if validate:
        errors = validate_pet_incident_payload(payload)
        if errors:
            raise ContractValidationError(errors)
    return PetIncidentContractV1.from_dict(payload)
