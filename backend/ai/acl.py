from dataclasses import dataclass, field
import logging
import math
import re
from typing import Any

logger = logging.getLogger(__name__)


class AIPayloadError(Exception):
    """Raised when an external AI payload is malformed or cannot be parsed."""
    pass


@dataclass(frozen=True)
class BreedPrediction:
    """Internal domain value object representing a predicted cat breed."""
    breed_name: str
    confidence: float
    raw_label: str = ''
    traits: tuple[str, ...] = ()

    def __post_init__(self):
        # Enforce confidence range [0.0, 1.0]
        clamped_conf = max(0.0, min(1.0, float(self.confidence)))
        object.__setattr__(self, 'confidence', round(clamped_conf, 4))
        object.__setattr__(self, 'breed_name', str(self.breed_name).strip())

    def to_dict(self) -> dict[str, Any]:
        return {
            'breed_name': self.breed_name,
            'confidence': self.confidence,
            'raw_label': self.raw_label,
            'traits': list(self.traits),
        }


@dataclass(frozen=True)
class VisualMatchResult:
    """Internal domain value object representing a visual similarity match."""
    target_id: str | None
    similarity_score: float
    is_match: bool
    matched_features: tuple[str, ...] = ()
    confidence: float = 0.0
    notes: str = ''
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        clamped_score = max(0.0, min(1.0, float(self.similarity_score)))
        clamped_conf = max(0.0, min(1.0, float(self.confidence)))
        object.__setattr__(self, 'similarity_score', round(clamped_score, 4))
        object.__setattr__(self, 'confidence', round(clamped_conf, 4))

    def to_dict(self) -> dict[str, Any]:
        return {
            'target_id': self.target_id,
            'similarity_score': self.similarity_score,
            'is_match': self.is_match,
            'matched_features': list(self.matched_features),
            'confidence': self.confidence,
            'notes': self.notes,
            'metadata': dict(self.metadata),
        }


@dataclass(frozen=True)
class AIAnalysisResult:
    """Internal domain structure aggregating AI breed and visual match outputs."""
    primary_breed: BreedPrediction | None = None
    top_breeds: tuple[BreedPrediction, ...] = ()
    visual_matches: tuple[VisualMatchResult, ...] = ()
    detected_features: tuple[str, ...] = ()
    model_name: str = ''
    model_version: str = ''
    raw_payload: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            'primary_breed': self.primary_breed.to_dict() if self.primary_breed else None,
            'top_breeds': [b.to_dict() for b in self.top_breeds],
            'visual_matches': [m.to_dict() for m in self.visual_matches],
            'detected_features': list(self.detected_features),
            'model_name': self.model_name,
            'model_version': self.model_version,
        }


def _normalize_score(value: Any) -> float:
    """Convert arbitrary numeric or string score into a float [0.0, 1.0]."""
    if value is None or isinstance(value, bool):
        return 0.0
    try:
        val = float(value)
        if math.isnan(val) or math.isinf(val):
            return 0.0
        # Handle percentage (e.g. 85 -> 0.85, 99.5 -> 0.995)
        if val > 1.0 and val <= 100.0:
            val = val / 100.0
        return max(0.0, min(1.0, val))
    except (ValueError, TypeError):
        return 0.0


def _normalize_breed_name(raw: Any) -> str:
    """Clean and standardize external breed strings."""
    if not raw or not isinstance(raw, str):
        return 'Unknown'

    cleaned = raw.strip()
    # Strip common machine learning label prefixes (e.g. 'n02123045_tabby' -> 'tabby')
    cleaned = re.sub(r'^(?:n\d{6,9}|\d+)[_-]', '', cleaned, flags=re.IGNORECASE)
    # Replace underscores and hyphens with spaces
    cleaned = re.sub(r'[_\-]+', ' ', cleaned)
    # Condense multiple spaces
    cleaned = ' '.join(cleaned.split())

    # Title casing with article/preposition awareness
    words = cleaned.split()
    capitalized_words = []
    for i, w in enumerate(words):
        if i > 0 and w.lower() in {'and', 'or', 'of', 'in', 'with', 'the', 'a', 'an'}:
            capitalized_words.append(w.lower())
        else:
            capitalized_words.append(w.capitalize())

    result = ' '.join(capitalized_words).strip()
    return result or 'Unknown'


def _normalize_features(raw: Any) -> tuple[str, ...]:
    """Normalize extracted features or traits into a clean tuple of strings."""
    if not raw:
        return ()

    features: list[str] = []
    if isinstance(raw, (list, tuple, set)):
        items = raw
    elif isinstance(raw, str):
        items = raw.replace(';', ',').split(',')
    elif isinstance(raw, dict):
        items = [f'{k}:{v}' for k, v in raw.items()]
    else:
        items = [str(raw)]

    for item in items:
        cleaned = ' '.join(str(item).replace('_', ' ').split()).strip().lower()
        if cleaned and cleaned not in features:
            features.append(cleaned)
    return tuple(features)


class AIAntiCorruptionLayer:
    """
    Anti-Corruption Layer (ACL) for AI service responses.
    
    Isolates domain models from varying external vision / classifier model payload
    structures (Google Vision, HuggingFace, Gemma, CLIP embeddings, custom ML endpoints).
    """

    DEFAULT_MATCH_THRESHOLD = 0.70

    def __init__(self, match_threshold: float = DEFAULT_MATCH_THRESHOLD):
        self.match_threshold = match_threshold

    def translate_breed_prediction(self, raw: Any) -> BreedPrediction | None:
        """
        Translate a single external breed prediction item into a `BreedPrediction`.
        Handles varied key schemas:
          {'label': 'Siamese', 'score': 0.92}
          {'breed': 'Maine Coon', 'confidence': 88.0}
          {'class_name': 'Domestic Shorthair', 'probability': 0.75}
          {'description': 'Siamese cat', 'score': 0.95} (Google Cloud Vision)
          {'Name': 'Cat', 'Confidence': 98.5} (AWS Rekognition)
        """
        if not raw:
            return None

        if isinstance(raw, str):
            breed_name = _normalize_breed_name(raw)
            return BreedPrediction(breed_name=breed_name, confidence=1.0, raw_label=raw)

        if not isinstance(raw, dict):
            return None

        candidate_label_keys = (
            'label', 'breed', 'breed_name', 'class_name', 'name', 'category',
            'prediction', 'description', 'displayName', 'display_name',
            'Name', 'Label', 'Description', 'Breed', 'BreedName'
        )
        raw_label = ''
        for k in candidate_label_keys:
            if k in raw and raw[k] is not None and str(raw[k]).strip():
                raw_label = str(raw[k]).strip()
                break

        if not raw_label:
            return None

        candidate_score_keys = (
            'score', 'confidence', 'probability', 'certainty', 'topicality',
            'Score', 'Confidence', 'Probability', 'Certainty'
        )
        raw_score = None
        for k in candidate_score_keys:
            if k in raw and raw[k] is not None:
                raw_score = raw[k]
                break
        if raw_score is None:
            raw_score = raw.get('weight', 1.0)

        breed_name = _normalize_breed_name(raw_label)
        confidence = _normalize_score(raw_score)
        traits = _normalize_features(raw.get('traits') or raw.get('features') or raw.get('attributes'))

        return BreedPrediction(
            breed_name=breed_name,
            confidence=confidence,
            raw_label=str(raw_label),
            traits=traits,
        )

    def translate_breed_predictions(self, payload: Any) -> tuple[BreedPrediction, ...]:
        """
        Extract and translate all breed predictions from an external AI payload.
        Sorts results by confidence descending.
        """
        if not payload:
            return ()

        items: list[Any] = []
        if isinstance(payload, list):
            items = payload
        elif isinstance(payload, dict):
            for candidate_key in (
                'predictions', 'breeds', 'candidates', 'labels', 'labelAnnotations',
                'Labels', 'results', 'data', 'classes', 'items', 'responses'
            ):
                val = payload.get(candidate_key)
                if isinstance(val, list):
                    items = val
                    break
            if not items:
                # Might be a single prediction object or key-value dictionary { 'Siamese': 0.9, 'Tabby': 0.1 }
                candidate_keys = (
                    'breed', 'breed_name', 'label', 'class_name', 'description',
                    'Name', 'Label', 'displayName'
                )
                if any(k in payload for k in candidate_keys):
                    items = [payload]
                else:
                    # Check if dict represents {breed_name: score}
                    for k, v in payload.items():
                        if not isinstance(v, bool) and (
                            isinstance(v, (int, float))
                            or (isinstance(v, str) and v.replace('.', '', 1).isdigit())
                        ):
                            items.append({'label': k, 'score': v})

        predictions: list[BreedPrediction] = []
        for item in items:
            pred = self.translate_breed_prediction(item)
            if pred:
                predictions.append(pred)

        predictions.sort(key=lambda p: p.confidence, reverse=True)
        return tuple(predictions)

    def translate_visual_match(
        self,
        raw: Any,
        match_threshold: float | None = None,
    ) -> VisualMatchResult | None:
        """
        Translate a single external visual match candidate into a `VisualMatchResult`.
        Handles schemas with similarities, distance metrics, feature overlaps, etc.
        """
        if not raw or not isinstance(raw, dict):
            return None

        threshold = match_threshold if match_threshold is not None else self.match_threshold

        target_id = None
        for k in (
            'target_id', 'report_id', 'id', 'candidate_id', 'match_id',
            'photo_id', 'TargetId', 'ReportId', 'Id'
        ):
            if k in raw and raw[k] is not None:
                target_id = raw[k]
                break
        target_id_str = str(target_id) if target_id is not None else None

        # Determine similarity score
        raw_score = None
        for k in ('similarity', 'similarity_score', 'score', 'confidence', 'Similarity', 'Score'):
            if k in raw and raw[k] is not None:
                raw_score = raw[k]
                break
        if raw_score is None:
            for dist_k in ('distance', 'Distance'):
                if dist_k in raw and raw[dist_k] is not None:
                    dist = _normalize_score(raw[dist_k])
                    raw_score = 1.0 - dist
                    break

        similarity = _normalize_score(raw_score) if raw_score is not None else 0.0
        confidence = _normalize_score(raw.get('confidence', similarity))

        is_match = raw.get('is_match')
        if is_match is None:
            is_match = similarity >= threshold
        else:
            is_match = bool(is_match)

        matched_features = _normalize_features(
            raw.get('matched_features')
            or raw.get('features')
            or raw.get('shared_traits')
            or raw.get('traits')
        )

        notes = str(raw.get('notes') or raw.get('description') or raw.get('reason') or '').strip()

        # Capture extraneous vendor metadata safely
        excluded_keys = {
            'target_id', 'report_id', 'id', 'candidate_id', 'match_id', 'photo_id',
            'similarity', 'similarity_score', 'score', 'confidence', 'distance',
            'is_match', 'matched_features', 'features', 'shared_traits', 'traits',
            'notes', 'description', 'reason',
        }
        metadata = {k: v for k, v in raw.items() if k not in excluded_keys}

        return VisualMatchResult(
            target_id=target_id_str,
            similarity_score=similarity,
            is_match=is_match,
            matched_features=matched_features,
            confidence=confidence,
            notes=notes,
            metadata=metadata,
        )

    def translate_visual_matches(
        self,
        payload: Any,
        match_threshold: float | None = None,
    ) -> tuple[VisualMatchResult, ...]:
        """
        Extract and translate all visual match candidates from an external payload.
        Sorts results by similarity_score descending.
        """
        if not payload:
            return ()

        items: list[Any] = []
        if isinstance(payload, list):
            items = payload
        elif isinstance(payload, dict):
            for candidate_key in ('matches', 'results', 'candidates', 'similar_reports', 'visual_matches', 'items'):
                val = payload.get(candidate_key)
                if isinstance(val, list):
                    items = val
                    break
            if not items and any(k in payload for k in ('target_id', 'report_id', 'similarity', 'score')):
                items = [payload]

        matches: list[VisualMatchResult] = []
        for item in items:
            match = self.translate_visual_match(item, match_threshold=match_threshold)
            if match:
                matches.append(match)

        matches.sort(key=lambda m: m.similarity_score, reverse=True)
        return tuple(matches)

    def translate_ai_response(
        self,
        payload: Any,
        match_threshold: float | None = None,
    ) -> AIAnalysisResult:
        """
        Translate a complete external AI response (containing breed and/or visual matches)
        into the unified internal `AIAnalysisResult`.
        """
        if not isinstance(payload, dict):
            if isinstance(payload, list):
                # Could be a list of breeds or a list of matches
                breeds = self.translate_breed_predictions(payload)
                return AIAnalysisResult(
                    primary_breed=breeds[0] if breeds else None,
                    top_breeds=breeds,
                )
            return AIAnalysisResult()

        breeds = self.translate_breed_predictions(payload)
        matches = self.translate_visual_matches(payload, match_threshold=match_threshold)

        detected_features = _normalize_features(
            payload.get('detected_features')
            or payload.get('features')
            or payload.get('attributes')
        )

        model_name = str(payload.get('model') or payload.get('model_name') or '').strip()
        model_version = str(payload.get('version') or payload.get('model_version') or '').strip()

        return AIAnalysisResult(
            primary_breed=breeds[0] if breeds else None,
            top_breeds=breeds,
            visual_matches=matches,
            detected_features=detected_features,
            model_name=model_name,
            model_version=model_version,
            raw_payload=payload,
        )


# Module-level convenience functions
_default_acl = AIAntiCorruptionLayer()

translate_breed_prediction = _default_acl.translate_breed_prediction
translate_breed_predictions = _default_acl.translate_breed_predictions
translate_visual_match = _default_acl.translate_visual_match
translate_visual_matches = _default_acl.translate_visual_matches
translate_ai_response = _default_acl.translate_ai_response
