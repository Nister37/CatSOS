from django.contrib import admin
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from reports.models import LostCatReport
from sightings.models import Sighting

from .models import PointTransaction, UserBadge
from .rules import (
    BADGE_RULES,
    POINT_RULES,
    SIGHTING_MARKED_USEFUL,
    SIGHTING_SUBMITTED,
    TRUSTED_REPORTER,
    TRUSTED_REPORTER_USEFUL_SIGHTING_COUNT,
    get_badge_rules_for_points,
    get_public_badge_labels_for_points,
    get_point_rule,
)
from .services import award_points, award_trusted_reporter_badge_for_useful_sighting


class PointRuleTests(TestCase):
    def test_point_rules_are_unique_and_positive(self):
        reasons = [rule.reason for rule in POINT_RULES]

        self.assertEqual(len(reasons), len(set(reasons)))
        for rule in POINT_RULES:
            self.assertGreater(rule.points, 0)
            self.assertTrue(rule.label)
            self.assertTrue(rule.description)

    def test_badge_rules_are_unique_and_ordered_by_threshold(self):
        codes = [rule.code for rule in BADGE_RULES]
        point_threshold_rules = [
            rule
            for rule in BADGE_RULES
            if rule.is_point_threshold
        ]
        thresholds = [rule.minimum_points for rule in point_threshold_rules]

        self.assertEqual(len(codes), len(set(codes)))
        self.assertEqual(thresholds, sorted(thresholds))
        for rule in point_threshold_rules:
            self.assertGreater(rule.minimum_points, 0)
            self.assertTrue(rule.label)
            self.assertTrue(rule.description)

    def test_special_badge_rules_are_not_point_thresholds(self):
        trusted_reporter = next(rule for rule in BADGE_RULES if rule.code == TRUSTED_REPORTER)

        self.assertFalse(trusted_reporter.is_point_threshold)
        self.assertIsNone(trusted_reporter.minimum_points)
        self.assertEqual(trusted_reporter.label, 'Trusted reporter')

    def test_rule_helpers_return_expected_mvp_values(self):
        self.assertEqual(get_point_rule(SIGHTING_SUBMITTED).points, 5)
        self.assertEqual(get_point_rule(SIGHTING_MARKED_USEFUL).points, 15)

        self.assertEqual(get_badge_rules_for_points(0), ())
        self.assertEqual(
            [rule.code for rule in get_badge_rules_for_points(80)],
            ['FIRST_HELP', 'NEIGHBOR_HELPER', 'SEARCH_REGULAR'],
        )
        self.assertEqual(
            get_public_badge_labels_for_points(150),
            ['First help', 'Neighbor helper', 'Search regular', 'Trusted helper'],
        )


class PointModelTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email='helper@example.com',
            password='StrongPass123!',
            is_email_verified=True,
        )

    def test_point_transaction_accepts_matching_rule_value(self):
        transaction = PointTransaction.objects.create(
            user=self.user,
            reason=SIGHTING_SUBMITTED,
            points=5,
            idempotency_key='sighting:123:submitted',
            description='Sighting submitted',
        )

        self.assertEqual(transaction.user, self.user)
        self.assertEqual(str(transaction), f'SIGHTING_SUBMITTED: 5 points for {self.user.pk}')

    def test_point_transaction_rejects_mismatched_rule_value(self):
        with self.assertRaises(ValidationError) as context:
            PointTransaction.objects.create(
                user=self.user,
                reason=SIGHTING_SUBMITTED,
                points=99,
                idempotency_key='sighting:123:bad-points',
            )

        self.assertIn('points', context.exception.message_dict)

    def test_point_transaction_idempotency_key_is_unique(self):
        PointTransaction.objects.create(
            user=self.user,
            reason=SIGHTING_SUBMITTED,
            points=5,
            idempotency_key='sighting:123:submitted',
        )

        with self.assertRaises(ValidationError) as context:
            PointTransaction.objects.create(
                user=self.user,
                reason=SIGHTING_SUBMITTED,
                points=5,
                idempotency_key='sighting:123:submitted',
            )

        self.assertIn('idempotency_key', context.exception.message_dict)

    def test_user_badge_normalizes_label_and_is_unique_per_user(self):
        badge = UserBadge.objects.create(
            user=self.user,
            code='NEIGHBOR_HELPER',
            label='Overridden label',
        )

        self.assertEqual(badge.label, 'Neighbor helper')
        self.assertEqual(str(badge), f'Neighbor helper for {self.user.pk}')

        with self.assertRaises(ValidationError) as context:
            UserBadge.objects.create(
                user=self.user,
                code='NEIGHBOR_HELPER',
                label='Neighbor helper',
            )

        self.assertIn('__all__', context.exception.message_dict)

    def test_points_models_are_registered_in_admin(self):
        self.assertTrue(admin.site.is_registered(PointTransaction))
        self.assertTrue(admin.site.is_registered(UserBadge))


class PointAwardServiceTests(TestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(
            email='owner@example.com',
            password='StrongPass123!',
            is_email_verified=True,
        )
        self.helper = get_user_model().objects.create_user(
            email='helper@example.com',
            password='StrongPass123!',
            is_email_verified=True,
            public_badges=['Manual community badge'],
        )
        self.report = LostCatReport.objects.create(
            owner=self.owner,
            cat_name='Luna',
            coat_color='Black',
            description='Likely hiding near gardens.',
            last_seen_address='12 Private Home Street',
            last_seen_landmark='Near the playground',
            contact_name='Marta Owner',
            contact_phone='+48 600 111 222',
            contact_email='owner@example.com',
        )
        self.sighting = Sighting.objects.create(
            report=self.report,
            submitted_by=self.helper,
            seen_at='2026-07-07T10:00:00Z',
            location_description='Behind the bakery',
            latitude=52.2297,
            longitude=21.0122,
            confidence=Sighting.Confidence.HIGH,
        )

    def _create_useful_sighting(self, *, submitted_by=None, report=None):
        return Sighting.objects.create(
            report=report or self.report,
            submitted_by=submitted_by or self.helper,
            seen_at=timezone.now(),
            location_description='Behind the bakery',
            latitude=52.2297,
            longitude=21.0122,
            confidence=Sighting.Confidence.HIGH,
            verification_status=Sighting.VerificationStatus.USEFUL,
            verified_by=self.owner,
            verified_at=timezone.now(),
        )

    def test_award_points_updates_user_total_and_public_badges(self):
        transaction, badges = award_points(
            user=self.helper,
            reason=SIGHTING_SUBMITTED,
            idempotency_key=f'sighting:{self.sighting.pk}:submitted',
            metadata={
                'sighting_id': str(self.sighting.pk),
                'report_id': str(self.report.pk),
            },
        )

        self.helper.refresh_from_db()
        self.assertEqual(transaction.points, 5)
        self.assertEqual(self.helper.contribution_points, 5)
        self.assertEqual([badge.code for badge in badges], ['FIRST_HELP'])
        self.assertEqual(
            self.helper.public_badges,
            ['Manual community badge', 'First help'],
        )
        self.assertEqual(
            PointTransaction.objects.get().metadata,
            {
                'sighting_id': str(self.sighting.pk),
                'report_id': str(self.report.pk),
            },
        )

    def test_award_points_is_idempotent_for_same_key(self):
        first_transaction, first_badges = award_points(
            user=self.helper,
            reason=SIGHTING_SUBMITTED,
            idempotency_key='sighting:duplicate:submitted',
        )
        second_transaction, second_badges = award_points(
            user=self.helper,
            reason=SIGHTING_SUBMITTED,
            idempotency_key='sighting:duplicate:submitted',
        )

        self.helper.refresh_from_db()
        self.assertEqual(first_transaction, second_transaction)
        self.assertEqual(first_badges, [UserBadge.objects.get(code='FIRST_HELP')])
        self.assertEqual(second_badges, [])
        self.assertEqual(PointTransaction.objects.count(), 1)
        self.assertEqual(self.helper.contribution_points, 5)

    def test_award_points_adds_threshold_badges_once(self):
        award_points(
            user=self.helper,
            reason=SIGHTING_SUBMITTED,
            idempotency_key='sighting:1:submitted',
        )
        award_points(
            user=self.helper,
            reason=SIGHTING_MARKED_USEFUL,
            idempotency_key='sighting:1:marked-useful',
        )
        transaction, badges = award_points(
            user=self.helper,
            reason=SIGHTING_MARKED_USEFUL,
            idempotency_key='sighting:2:marked-useful',
        )

        self.helper.refresh_from_db()
        self.assertEqual(transaction.points, 15)
        self.assertEqual(self.helper.contribution_points, 35)
        self.assertEqual([badge.code for badge in badges], ['NEIGHBOR_HELPER'])
        self.assertEqual(
            list(UserBadge.objects.filter(user=self.helper).values_list('code', flat=True)),
            ['FIRST_HELP', 'NEIGHBOR_HELPER'],
        )
        self.assertEqual(
            self.helper.public_badges,
            ['Manual community badge', 'First help', 'Neighbor helper'],
        )

    def test_award_points_skips_missing_user(self):
        transaction, badges = award_points(
            user=None,
            reason=SIGHTING_SUBMITTED,
            idempotency_key='anonymous:submitted',
        )

        self.assertIsNone(transaction)
        self.assertEqual(badges, [])
        self.assertFalse(PointTransaction.objects.exists())

    def test_trusted_reporter_badge_requires_repeated_useful_sightings(self):
        first_sighting = self._create_useful_sighting()

        badge, created = award_trusted_reporter_badge_for_useful_sighting(
            sighting=first_sighting,
        )

        self.assertIsNone(badge)
        self.assertFalse(created)
        self.assertFalse(UserBadge.objects.filter(code=TRUSTED_REPORTER).exists())

        self._create_useful_sighting()
        threshold_sighting = self._create_useful_sighting()

        badge, created = award_trusted_reporter_badge_for_useful_sighting(
            sighting=threshold_sighting,
        )
        duplicate_badge, duplicate_created = (
            award_trusted_reporter_badge_for_useful_sighting(
                sighting=threshold_sighting,
            )
        )

        self.helper.refresh_from_db()
        self.assertTrue(created)
        self.assertFalse(duplicate_created)
        self.assertEqual(duplicate_badge, badge)
        self.assertEqual(badge.code, TRUSTED_REPORTER)
        self.assertEqual(
            badge.metadata,
            {'useful_sighting_count': TRUSTED_REPORTER_USEFUL_SIGHTING_COUNT},
        )
        self.assertEqual(UserBadge.objects.filter(code=TRUSTED_REPORTER).count(), 1)
        self.assertEqual(
            self.helper.public_badges,
            ['Manual community badge', 'Trusted reporter'],
        )

    def test_trusted_reporter_badge_skips_owner_self_sightings(self):
        owner_sighting = self._create_useful_sighting(
            submitted_by=self.owner,
            report=self.report,
        )

        badge, created = award_trusted_reporter_badge_for_useful_sighting(
            sighting=owner_sighting,
        )

        self.assertIsNone(badge)
        self.assertFalse(created)
        self.assertFalse(UserBadge.objects.filter(user=self.owner).exists())


class LeaderboardApiTests(APITestCase):
    def _create_user(self, **overrides):
        defaults = {
            'email': f'user-{get_user_model().objects.count()}@example.com',
            'password': 'StrongPass123!',
            'is_email_verified': True,
            'display_name': 'Helpful Neighbor',
            'contribution_points': 10,
            'public_badges': ['First help'],
        }
        defaults.update(overrides)
        return get_user_model().objects.create_user(**defaults)

    def _url(self):
        return reverse('points-leaderboard')

    def test_leaderboard_returns_ranked_public_safe_contributors(self):
        top_user = self._create_user(
            email='top-secret@example.com',
            display_name='Top Helper',
            contribution_points=75,
            public_badges=['Search regular'],
            first_name='Private',
            last_name='Person',
        )
        second_user = self._create_user(
            email='second-secret@example.com',
            display_name='Second Helper',
            contribution_points=25,
            public_badges=['Neighbor helper'],
        )
        UserBadge.objects.create(user=top_user, code='SEARCH_REGULAR', label='Search regular')

        response = self.client.get(self._url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(response.data['results'][0]['rank'], 1)
        self.assertEqual(response.data['results'][0]['id'], top_user.pk)
        self.assertEqual(response.data['results'][0]['display_name'], 'Top Helper')
        self.assertEqual(response.data['results'][0]['points'], 75)
        self.assertEqual(response.data['results'][0]['badges'], ['Search regular'])
        self.assertEqual(response.data['results'][1]['rank'], 2)
        self.assertEqual(response.data['results'][1]['id'], second_user.pk)
        self.assertEqual(response.data['results'][1]['points'], 25)
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.assertEqual(response['Pragma'], 'no-cache')

        serialized = str(response.data)
        self.assertNotIn('top-secret@example.com', serialized)
        self.assertNotIn('second-secret@example.com', serialized)
        self.assertNotIn('Private', serialized)
        self.assertNotIn('point_transactions', serialized)
        self.assertNotIn('idempotency', serialized)

    def test_leaderboard_filters_private_or_empty_profiles(self):
        visible_user = self._create_user(
            email='visible@example.com',
            display_name='Visible Helper',
            contribution_points=5,
        )
        self._create_user(
            email='zero@example.com',
            display_name='No Points',
            contribution_points=0,
        )
        self._create_user(
            email='unverified@example.com',
            display_name='Unverified Helper',
            contribution_points=100,
            is_email_verified=False,
        )
        self._create_user(
            email='inactive@example.com',
            display_name='Inactive Helper',
            contribution_points=100,
            is_active=False,
        )

        response = self.client.get(self._url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['id'], visible_user.pk)

    def test_leaderboard_paginates_and_keeps_global_rank(self):
        for index in range(3):
            self._create_user(
                email=f'helper-{index}@example.com',
                display_name=f'Helper {index}',
                contribution_points=30 - index,
            )

        response = self.client.get(self._url(), {'page_size': 2, 'page': 2})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 3)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['rank'], 3)
