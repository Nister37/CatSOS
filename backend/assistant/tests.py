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
            {'injury', 'collar', 'microchip', 'friendliness', 'location'},
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
        urgent_help = nodes[yes_answer['next_node_id']]

        self.assertEqual(urgent_help['type'], 'outcome')
        self.assertEqual(urgent_help['severity'], 'emergency')
        self.assertIn('Do not attempt treatment or diagnosis.', urgent_help['guidance'])
        serialized = str(urgent_help).lower()
        self.assertNotIn('give medication', serialized)
        self.assertNotIn('diagnose the cat', serialized)

    def test_decision_tree_references_existing_nodes_only(self):
        response = self.client.get(self._url())

        nodes = {node['id']: node for node in response.data['nodes']}
        for node in nodes.values():
            for answer in node.get('answers', []):
                self.assertIn(answer['next_node_id'], nodes)
