from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


class FoundCatDecisionTreeApiTests(APITestCase):
    def _url(self):
        return reverse('found-cat-decision-tree')

    def test_decision_tree_is_public_and_safe(self):
        response = self.client.get(self._url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.assertEqual(response['Pragma'], 'no-cache')
        self.assertEqual(response.data['id'], 'found-cat')
        self.assertEqual(response.data['entry_node_id'], 'injury')
        self.assertIn('veterinary diagnosis', response.data['safety_notice'])
        self.assertIn('does not replace', response.data['safety_notice'])

    def test_decision_tree_contains_required_questions(self):
        response = self.client.get(self._url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        question_nodes = {
            node['id']: node
            for node in response.data['nodes']
            if node['type'] == 'question'
        }
        self.assertEqual(
            set(question_nodes),
            {
                'injury', 'collar', 'microchip', 'friendliness', 'location',
                'emergency_severity', 'friendly_cat_care', 'afraid_feral_cat',
            },
        )
        for node in question_nodes.values():
            self.assertGreaterEqual(len(node['answers']), 2)
            for answer in node['answers']:
                self.assertIn('next_node_id', answer)

    def test_injury_branch_uses_emergency_guidance_without_diagnosis(self):
        response = self.client.get(self._url())

        nodes = {node['id']: node for node in response.data['nodes']}
        injury_node = nodes['injury']
        yes_answer = next(
            answer
            for answer in injury_node['answers']
            if answer['id'] == 'yes'
        )
        # Injury 'yes' now leads to emergency_severity question
        emergency_severity = nodes[yes_answer['next_node_id']]
        self.assertEqual(emergency_severity['type'], 'question')

        # Following any emergency_severity answer should lead to emergency outcomes
        for answer in emergency_severity['answers']:
            target = nodes[answer['next_node_id']]
            self.assertEqual(target['type'], 'outcome')
            self.assertEqual(target['severity'], 'emergency')
            # No emergency outcome should suggest treatment or diagnosis
            serialized = str(target['guidance']).lower()
            self.assertNotIn('give medication', serialized)
            self.assertNotIn('diagnose the cat', serialized)

    def test_decision_tree_references_existing_nodes_only(self):
        response = self.client.get(self._url())

        nodes = {node['id']: node for node in response.data['nodes']}
        for node in nodes.values():
            for answer in node.get('answers', []):
                self.assertIn(answer['next_node_id'], nodes)

    # ------------------------------------------------------------------
    # CAT-075: Emergency branch tests
    # ------------------------------------------------------------------

    def test_emergency_severity_branches_to_correct_outcomes(self):
        response = self.client.get(self._url())
        nodes = {node['id']: node for node in response.data['nodes']}

        severity_node = nodes['emergency_severity']
        self.assertEqual(severity_node['type'], 'question')
        self.assertEqual(len(severity_node['answers']), 4)

        expected_targets = {
            'bleeding_or_hit': 'urgent_help',
            'trapped': 'emergency_trapped',
            'sick_lethargic': 'emergency_sick',
            'other_danger': 'urgent_help',
        }
        for answer in severity_node['answers']:
            self.assertEqual(
                answer['next_node_id'],
                expected_targets[answer['id']],
            )

    def test_emergency_trapped_outcome_has_correct_advice(self):
        response = self.client.get(self._url())
        nodes = {node['id']: node for node in response.data['nodes']}

        trapped = nodes['emergency_trapped']
        self.assertEqual(trapped['type'], 'outcome')
        self.assertEqual(trapped['severity'], 'emergency')
        self.assertIn(
            'Do not force the cat out — this can cause injury.',
            trapped['guidance'],
        )
        self.assertTrue(
            any('/api/maps/nearby-help/' in link['endpoint'] for link in trapped['links']),
        )

    def test_emergency_sick_outcome_has_correct_advice(self):
        response = self.client.get(self._url())
        nodes = {node['id']: node for node in response.data['nodes']}

        sick = nodes['emergency_sick']
        self.assertEqual(sick['type'], 'outcome')
        self.assertEqual(sick['severity'], 'emergency')
        self.assertIn(
            'Do not give the cat any medication.',
            sick['guidance'],
        )
        self.assertIn(
            'Keep the cat warm and sheltered from wind and rain.',
            sick['guidance'],
        )
        self.assertTrue(
            any('/api/maps/nearby-help/' in link['endpoint'] for link in sick['links']),
        )

    def test_urgent_help_has_nearby_help_link(self):
        response = self.client.get(self._url())
        nodes = {node['id']: node for node in response.data['nodes']}

        urgent = nodes['urgent_help']
        self.assertEqual(urgent['severity'], 'emergency')
        self.assertIn(
            'Do not move an injured cat unless it is in immediate further danger.',
            urgent['guidance'],
        )
        self.assertTrue(
            any('/api/maps/nearby-help/' in link['endpoint'] for link in urgent['links']),
        )

    # ------------------------------------------------------------------
    # CAT-076: Collar with tag branch tests
    # ------------------------------------------------------------------

    def test_collar_visible_contact_leads_to_collar_with_tag(self):
        response = self.client.get(self._url())
        nodes = {node['id']: node for node in response.data['nodes']}

        collar_node = nodes['collar']
        visible_answer = next(
            a for a in collar_node['answers'] if a['id'] == 'visible_contact'
        )
        self.assertEqual(visible_answer['next_node_id'], 'collar_with_tag')

        tag_outcome = nodes['collar_with_tag']
        self.assertEqual(tag_outcome['type'], 'outcome')
        self.assertIn(
            'Call the number on the tag if one is visible.',
            tag_outcome['guidance'],
        )
        self.assertIn(
            'Read the tag carefully — look for a name, phone number, or address.',
            tag_outcome['guidance'],
        )
        self.assertIn(
            'The cat may also be microchipped — consider a vet scan as a backup.',
            tag_outcome['guidance'],
        )

    # ------------------------------------------------------------------
    # CAT-076: Microchip scan advice branch tests
    # ------------------------------------------------------------------

    def test_microchip_not_checked_leads_to_scan_advice(self):
        response = self.client.get(self._url())
        nodes = {node['id']: node for node in response.data['nodes']}

        microchip_node = nodes['microchip']
        not_checked = next(
            a for a in microchip_node['answers'] if a['id'] == 'not_checked'
        )
        self.assertEqual(not_checked['next_node_id'], 'microchip_scan_advice')

        scan_advice = nodes['microchip_scan_advice']
        self.assertEqual(scan_advice['type'], 'outcome')
        self.assertIn(
            'Most vets and shelters will scan for a microchip free of charge.',
            scan_advice['guidance'],
        )
        self.assertTrue(
            any('/api/maps/nearby-help/' in link['endpoint'] for link in scan_advice['links']),
        )

    # ------------------------------------------------------------------
    # CAT-076: Friendly cat branch tests
    # ------------------------------------------------------------------

    def test_friendly_cat_care_is_question_with_shelter_option(self):
        response = self.client.get(self._url())
        nodes = {node['id']: node for node in response.data['nodes']}

        friendly = nodes['friendly_cat_care']
        self.assertEqual(friendly['type'], 'question')
        answer_ids = {a['id'] for a in friendly['answers']}
        self.assertIn('can_shelter', answer_ids)
        self.assertIn('cannot_shelter', answer_ids)

    def test_friendly_cat_shelter_outcome_has_correct_advice(self):
        response = self.client.get(self._url())
        nodes = {node['id']: node for node in response.data['nodes']}

        shelter = nodes['friendly_cat_shelter']
        self.assertEqual(shelter['type'], 'outcome')
        self.assertIn(
            'Keep the cat in a quiet, enclosed room away from other pets.',
            shelter['guidance'],
        )
        self.assertIn(
            'Visit a vet to scan for a microchip as soon as possible.',
            shelter['guidance'],
        )

    # ------------------------------------------------------------------
    # CAT-076: Afraid / feral cat branch tests
    # ------------------------------------------------------------------

    def test_afraid_feral_cat_is_question_with_feral_and_lost_options(self):
        response = self.client.get(self._url())
        nodes = {node['id']: node for node in response.data['nodes']}

        afraid = nodes['afraid_feral_cat']
        self.assertEqual(afraid['type'], 'question')
        answer_ids = {a['id'] for a in afraid['answers']}
        self.assertIn('likely_feral', answer_ids)
        self.assertIn('likely_lost', answer_ids)
        self.assertIn('not_sure', answer_ids)

    def test_feral_cat_advice_does_not_suggest_chasing(self):
        response = self.client.get(self._url())
        nodes = {node['id']: node for node in response.data['nodes']}

        feral = nodes['feral_cat_advice']
        self.assertEqual(feral['type'], 'outcome')
        self.assertIn(
            'Do not chase or attempt to catch a feral cat.',
            feral['guidance'],
        )
        self.assertIn(
            'Leave food and fresh water at a safe distance.',
            feral['guidance'],
        )

    def test_scared_lost_cat_advice_has_observation_guidance(self):
        response = self.client.get(self._url())
        nodes = {node['id']: node for node in response.data['nodes']}

        scared = nodes['scared_lost_cat_advice']
        self.assertEqual(scared['type'], 'outcome')
        self.assertIn(
            'Do not chase — sit quietly and let the cat approach on its own terms.',
            scared['guidance'],
        )
        self.assertIn(
            'Leave food and water nearby and observe from a distance.',
            scared['guidance'],
        )
