from django.contrib import admin
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase

from .models import PointTransaction, UserBadge
from .rules import (
    BADGE_RULES,
    POINT_RULES,
    SIGHTING_MARKED_USEFUL,
    SIGHTING_SUBMITTED,
    get_badge_rules_for_points,
    get_public_badge_labels_for_points,
    get_point_rule,
)


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
        thresholds = [rule.minimum_points for rule in BADGE_RULES]

        self.assertEqual(len(codes), len(set(codes)))
        self.assertEqual(thresholds, sorted(thresholds))
        for rule in BADGE_RULES:
            self.assertGreater(rule.minimum_points, 0)
            self.assertTrue(rule.label)
            self.assertTrue(rule.description)

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
