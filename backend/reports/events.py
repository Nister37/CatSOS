from dataclasses import dataclass, field
from datetime import datetime
import logging
from typing import Any, Callable
from uuid import uuid4

from django.dispatch import Signal
from django.utils import timezone

logger = logging.getLogger(__name__)

# Django signals corresponding to domain events
report_created_signal = Signal()       # providing_args=['event', 'report', 'actor']
sighting_verified_signal = Signal()    # providing_args=['event', 'sighting', 'actor']
cat_reunited_signal = Signal()         # providing_args=['event', 'report', 'actor']


@dataclass(frozen=True)
class DomainEvent:
    """Base class for all domain events."""
    event_id: str = field(default_factory=lambda: str(uuid4()))
    occurred_at: datetime = field(default_factory=timezone.now)


@dataclass(frozen=True)
class ReportCreatedEvent(DomainEvent):
    """Domain event published when a lost cat report is created."""
    report_id: str = ''
    report: Any = None
    actor: Any = None
    cat_name: str = ''
    status: str = ''
    location_summary: str = ''


@dataclass(frozen=True)
class SightingVerifiedEvent(DomainEvent):
    """Domain event published when a sighting verification status changes."""
    sighting_id: str = ''
    sighting: Any = None
    report_id: str = ''
    actor: Any = None
    verification_status: str = ''
    previous_status: str = ''
    location_summary: str = ''


@dataclass(frozen=True)
class CatReunitedEvent(DomainEvent):
    """Domain event published when a missing cat is marked as found / reunited."""
    report_id: str = ''
    report: Any = None
    actor: Any = None
    found_message: str = ''
    previous_status: str = ''
    status: str = 'FOUND'


class EventDispatcher:
    """
    In-memory domain event dispatcher with support for subscriptions and Django signals.
    Decouples domain state changes from side effects (karma points, email/push notifications).
    """

    def __init__(self):
        self._subscribers: dict[type, list[Callable[[Any], None]]] = {}

    def subscribe(self, event_type: type, handler: Callable[[Any], None]) -> None:
        """Register a handler callback for an event type."""
        handlers = self._subscribers.setdefault(event_type, [])
        if handler not in handlers:
            handlers.append(handler)

    def unsubscribe(self, event_type: type, handler: Callable[[Any], None]) -> None:
        """Remove a handler callback for an event type."""
        if event_type in self._subscribers:
            handlers = self._subscribers[event_type]
            if handler in handlers:
                handlers.remove(handler)

    def clear_subscribers(self) -> None:
        """Clear all registered event handlers (useful in test teardown)."""
        self._subscribers.clear()

    def publish(self, event: DomainEvent) -> list[Any]:
        """
        Publish an event to all registered in-memory subscribers and emit the corresponding Django signal.
        """
        results = []
        event_cls = event.__class__

        # 1. In-memory registered handlers (checking exact type and any base classes)
        for registered_type, handlers in list(self._subscribers.items()):
            if issubclass(event_cls, registered_type):
                for handler in list(handlers):
                    try:
                        res = handler(event)
                        results.append(res)
                    except Exception as exc:
                        logger.exception('Error in event handler %r for event %r: %s', handler, event, exc)

        # 2. Django signal dispatch
        try:
            if isinstance(event, ReportCreatedEvent):
                report_created_signal.send(
                    sender=event_cls,
                    event=event,
                    report=event.report,
                    actor=event.actor,
                )
            elif isinstance(event, SightingVerifiedEvent):
                sighting_verified_signal.send(
                    sender=event_cls,
                    event=event,
                    sighting=event.sighting,
                    actor=event.actor,
                )
            elif isinstance(event, CatReunitedEvent):
                cat_reunited_signal.send(
                    sender=event_cls,
                    event=event,
                    report=event.report,
                    actor=event.actor,
                )
        except Exception as exc:
            logger.exception('Error sending Django signal for domain event %r: %s', event, exc)

        return results


# Global singleton dispatcher instance
event_dispatcher = EventDispatcher()


def publish_domain_event(event: DomainEvent) -> list[Any]:
    """Convenience helper to publish a domain event via the global dispatcher."""
    return event_dispatcher.publish(event)


# ==============================================================================
# Side-Effect Handlers (Karma Points, Notifications)
# ==============================================================================

def on_report_created_notifications(event: ReportCreatedEvent) -> None:
    """Dispatches owner/matching notifications when a report is created."""
    if event.report is not None:
        from notifications.services import enqueue_report_created_notification
        enqueue_report_created_notification(report=event.report, actor=event.actor)


def on_sighting_verified_side_effects(event: SightingVerifiedEvent) -> None:
    """
    Decoupled side effects for sighting verification:
      1. Awards karma contribution points and trusted reporter badge if marked useful.
      2. Enqueues helper notification.
    """
    sighting = event.sighting
    actor = event.actor
    if sighting is None:
        return

    from points.services import (
        award_sighting_marked_useful_points,
        award_trusted_reporter_badge_for_useful_sighting,
    )
    from notifications.services import enqueue_sighting_verification_notification

    # Award points if status is USEFUL
    is_useful = str(event.verification_status).upper() == 'USEFUL'
    if is_useful:
        award_sighting_marked_useful_points(sighting=sighting)
        award_trusted_reporter_badge_for_useful_sighting(sighting=sighting)

    # Enqueue verification notification
    enqueue_sighting_verification_notification(sighting=sighting, actor=actor)


def on_cat_reunited_side_effects(event: CatReunitedEvent) -> None:
    """Dispatches status changed notifications when a cat is reunited."""
    report = event.report
    actor = event.actor
    if report is not None:
        from notifications.services import enqueue_report_status_changed_notification
        enqueue_report_status_changed_notification(
            report=report,
            old_status=event.previous_status,
            new_status=getattr(report, 'status', 'FOUND'),
            actor=actor,
        )


_handlers_registered = False


def register_domain_event_handlers() -> None:
    """Idempotently register all domain event listeners."""
    global _handlers_registered
    if _handlers_registered:
        return

    event_dispatcher.subscribe(ReportCreatedEvent, on_report_created_notifications)
    event_dispatcher.subscribe(SightingVerifiedEvent, on_sighting_verified_side_effects)
    event_dispatcher.subscribe(CatReunitedEvent, on_cat_reunited_side_effects)
    _handlers_registered = True


# Auto-register on import
register_domain_event_handlers()
