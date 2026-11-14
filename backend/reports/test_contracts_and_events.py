from unittest.mock import Mock, patch
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.test import TestCase

from reports.contracts import (
    CONTRACT_VERSION_V1,
    AnimalDetailsV1,
    ContactDetailsV1,
    ContractValidationError,
    LocationDetailsV1,
    PetIncidentContractV1,
    RewardDetailsV1,
    deserialize_pet_incident_v1,
    serialize_pet_incident_v1,
    validate_pet_incident_payload,
)
from reports.events import (
    CatReunitedEvent,
    EventDispatcher,
    ReportCreatedEvent,
    SightingVerifiedEvent,
    cat_reunited_signal,
    event_dispatcher,
    publish_domain_event,
    report_created_signal,
    sighting_verified_signal,
)
from reports.models import LostCatReport

User = get_user_model()


class PublishedLanguageContractTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='reporter@example.com',
            password='TestPassword123!',
        )
        self.report = LostCatReport.objects.create(
            owner=self.user,
            cat_name='Luna',
            breed='Siamese',
            coat_color='Cream / Brown points',
            gender=LostCatReport.Gender.FEMALE,
            personality='Friendly but vocal',
            last_seen_address='Main Street 42',
            last_seen_landmark='Near the fountain',
            last_seen_lat=52.2300,
            last_seen_lng=21.0100,
            contact_name='Alice',
            contact_phone='+48 500 000 111',
            contact_email='alice@example.com',
            status=LostCatReport.Status.MISSING,
            public_summary='Missing female Siamese cat near fountain',
            description='Luna slipped out the door this morning.',
            reward_amount=100.0,
            reward_note='No questions asked',
        )

    def test_contract_from_report_and_serialization(self):
        contract = PetIncidentContractV1.from_report(self.report, base_url='https://catsos.org')

        self.assertEqual(contract.schema_version, CONTRACT_VERSION_V1)
        self.assertEqual(contract.incident_id, str(self.report.public_id))
        self.assertEqual(contract.incident_type, 'LOST')
        self.assertEqual(contract.status, 'ACTIVE')
        self.assertEqual(contract.animal.name, 'Luna')
        self.assertEqual(contract.animal.breed, 'Siamese')
        self.assertEqual(contract.animal.gender, 'FEMALE')
        self.assertEqual(contract.location.address, 'Main Street 42')
        self.assertEqual(contract.location.latitude, 52.23)
        self.assertEqual(contract.location.longitude, 21.01)
        self.assertTrue(contract.reward.offered)
        self.assertEqual(contract.reward.amount, 100.0)
        self.assertEqual(contract.public_url, f'https://catsos.org/reports/{self.report.public_id}')

        # Test to_dict and serialization helper
        payload = serialize_pet_incident_v1(contract)
        self.assertEqual(payload['schema_version'], 'v1')
        self.assertEqual(payload['animal']['name'], 'Luna')

        # Test JSON round-trip
        json_data = contract.to_json()
        restored = deserialize_pet_incident_v1(json_data)
        self.assertEqual(restored.incident_id, contract.incident_id)
        self.assertEqual(restored.animal.name, 'Luna')

    def test_status_mapping_for_resolved_and_closed(self):
        self.report.status = LostCatReport.Status.FOUND
        contract_found = PetIncidentContractV1.from_report(self.report)
        self.assertEqual(contract_found.status, 'RESOLVED')

        self.report.status = LostCatReport.Status.CLOSED
        contract_closed = PetIncidentContractV1.from_report(self.report)
        self.assertEqual(contract_closed.status, 'CLOSED')

    def test_validation_helpers(self):
        valid_payload = {
            'schema_version': 'v1',
            'incident_id': str(uuid4()),
            'incident_type': 'LOST',
            'status': 'ACTIVE',
            'animal': {
                'name': 'Milo',
                'species': 'cat',
                'breed': 'Tabby',
                'gender': 'MALE',
                'age_years': 3,
            },
            'location': {
                'address': 'Park Street 5',
                'latitude': 50.12,
                'longitude': 19.98,
            },
            'summary': 'Lost ginger cat',
            'description': 'Friendly ginger tabby lost in park',
            'reported_at': '2026-11-14T00:00:00Z',
        }
        errors = validate_pet_incident_payload(valid_payload)
        self.assertEqual(errors, [])

        contract = deserialize_pet_incident_v1(valid_payload)
        self.assertEqual(contract.animal.name, 'Milo')

    def test_validation_catches_invalid_payload(self):
        invalid_payload = {
            'schema_version': 'v999',  # invalid version
            'incident_id': '',        # empty id
            'animal': {
                'name': '',
                'gender': 'INVALID_GENDER',
                'age_years': 100,     # out of range
            },
            'location': {
                'latitude': 120.0,    # out of range [-90, 90]
                'longitude': -200.0,  # out of range [-180, 180]
            },
            'status': 'UNKNOWN_STATUS',
        }
        errors = validate_pet_incident_payload(invalid_payload)
        self.assertGreater(len(errors), 3)

        with self.assertRaises(ContractValidationError):
            deserialize_pet_incident_v1(invalid_payload)


class DomainEventsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='owner@example.com',
            password='TestPassword123!',
        )
        self.report = LostCatReport.objects.create(
            owner=self.user,
            cat_name='Shadow',
            coat_color='Black',
            last_seen_address='Dark Lane 1',
            status=LostCatReport.Status.MISSING,
            contact_name='Owner',
            contact_phone='+48 600 000 000',
            contact_email='owner@example.com',
            description='Lost black cat',
        )

    def test_custom_dispatcher_subscribe_publish_and_clear(self):
        dispatcher = EventDispatcher()
        received_events = []

        def sample_listener(event):
            received_events.append(event)

        dispatcher.subscribe(ReportCreatedEvent, sample_listener)

        evt = ReportCreatedEvent(
            report_id=str(self.report.pk),
            report=self.report,
            actor=self.user,
            cat_name=self.report.cat_name,
        )
        dispatcher.publish(evt)

        self.assertEqual(len(received_events), 1)
        self.assertEqual(received_events[0].cat_name, 'Shadow')

        # Test unsubscribe
        dispatcher.unsubscribe(ReportCreatedEvent, sample_listener)
        dispatcher.publish(evt)
        self.assertEqual(len(received_events), 1)

        # Test clear
        dispatcher.subscribe(ReportCreatedEvent, sample_listener)
        dispatcher.clear_subscribers()
        dispatcher.publish(evt)
        self.assertEqual(len(received_events), 1)

    @patch('notifications.services.enqueue_report_created_notification')
    def test_report_created_event_dispatches_notification_and_signal(self, mock_notify):
        signal_received = []

        def signal_handler(sender, **kwargs):
            signal_received.append(kwargs.get('event'))

        report_created_signal.connect(signal_handler)
        try:
            event = ReportCreatedEvent(
                report_id=str(self.report.pk),
                report=self.report,
                actor=self.user,
                cat_name='Shadow',
                status='MISSING',
            )
            publish_domain_event(event)

            mock_notify.assert_called_once_with(report=self.report, actor=self.user)
            self.assertEqual(len(signal_received), 1)
            self.assertEqual(signal_received[0].cat_name, 'Shadow')
        finally:
            report_created_signal.disconnect(signal_handler)

    @patch('points.services.award_sighting_marked_useful_points')
    @patch('points.services.award_trusted_reporter_badge_for_useful_sighting')
    @patch('notifications.services.enqueue_sighting_verification_notification')
    def test_sighting_verified_event_dispatches_karma_and_notification(
        self,
        mock_notify,
        mock_badge,
        mock_points,
    ):
        mock_sighting = Mock()
        mock_sighting.pk = 'sight-123'
        mock_sighting.report_id = self.report.pk

        event = SightingVerifiedEvent(
            sighting_id='sight-123',
            sighting=mock_sighting,
            report_id=str(self.report.pk),
            actor=self.user,
            verification_status='USEFUL',
            previous_status='PENDING',
        )
        publish_domain_event(event)

        mock_points.assert_called_once_with(sighting=mock_sighting)
        mock_badge.assert_called_once_with(sighting=mock_sighting)
        mock_notify.assert_called_once_with(sighting=mock_sighting, actor=self.user)

    @patch('points.services.award_sighting_marked_useful_points')
    @patch('notifications.services.enqueue_sighting_verification_notification')
    def test_sighting_verified_false_does_not_award_points(
        self,
        mock_notify,
        mock_points,
    ):
        mock_sighting = Mock()
        mock_sighting.pk = 'sight-456'

        event = SightingVerifiedEvent(
            sighting_id='sight-456',
            sighting=mock_sighting,
            actor=self.user,
            verification_status='FALSE',
            previous_status='PENDING',
        )
        publish_domain_event(event)

        mock_points.assert_not_called()
        mock_notify.assert_called_once_with(sighting=mock_sighting, actor=self.user)

    @patch('notifications.services.enqueue_report_status_changed_notification')
    def test_cat_reunited_event_dispatches_status_notification_and_signal(self, mock_notify):
        signal_received = []

        def signal_handler(sender, **kwargs):
            signal_received.append(kwargs.get('event'))

        cat_reunited_signal.connect(signal_handler)
        try:
            event = CatReunitedEvent(
                report_id=str(self.report.pk),
                report=self.report,
                actor=self.user,
                found_message='Found in neighbor garden!',
                previous_status='MISSING',
                status='FOUND',
            )
            publish_domain_event(event)

            mock_notify.assert_called_once_with(
                report=self.report,
                old_status='MISSING',
                new_status=self.report.status,
                actor=self.user,
            )
            self.assertEqual(len(signal_received), 1)
            self.assertEqual(signal_received[0].found_message, 'Found in neighbor garden!')
        finally:
            cat_reunited_signal.disconnect(signal_handler)
