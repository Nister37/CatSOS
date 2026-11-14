from django.test import SimpleTestCase

from ai.acl import (
    AIAntiCorruptionLayer,
    AIAnalysisResult,
    BreedPrediction,
    VisualMatchResult,
    _normalize_breed_name,
    _normalize_score,
    translate_ai_response,
    translate_breed_prediction,
    translate_breed_predictions,
    translate_visual_match,
    translate_visual_matches,
)


class AIModelACLTests(SimpleTestCase):
    def setUp(self):
        self.acl = AIAntiCorruptionLayer(match_threshold=0.75)

    def test_score_normalization(self):
        self.assertAlmostEqual(_normalize_score(0.85), 0.85)
        self.assertAlmostEqual(_normalize_score('0.92'), 0.92)
        # Percentage to decimal
        self.assertAlmostEqual(_normalize_score(88), 0.88)
        self.assertAlmostEqual(_normalize_score('95.5'), 0.955)
        # Clamping
        self.assertEqual(_normalize_score(-5), 0.0)
        self.assertEqual(_normalize_score(150), 1.0)
        self.assertEqual(_normalize_score('invalid'), 0.0)
        self.assertEqual(_normalize_score(None), 0.0)

    def test_breed_name_normalization(self):
        self.assertEqual(_normalize_breed_name('maine_coon'), 'Maine Coon')
        self.assertEqual(_normalize_breed_name('n02123045_tabby'), 'Tabby')
        self.assertEqual(_normalize_breed_name('british_shorthair_cat'), 'British Shorthair Cat')
        self.assertEqual(_normalize_breed_name('  siamese   '), 'Siamese')
        self.assertEqual(_normalize_breed_name(''), 'Unknown')
        self.assertEqual(_normalize_breed_name(None), 'Unknown')

    def test_translate_breed_prediction_standard_keys(self):
        # Key schema 1: label and score
        raw_1 = {'label': 'ragdoll', 'score': 0.94, 'traits': ['blue_eyes', 'fluffy']}
        pred_1 = self.acl.translate_breed_prediction(raw_1)
        self.assertIsNotNone(pred_1)
        self.assertEqual(pred_1.breed_name, 'Ragdoll')
        self.assertAlmostEqual(pred_1.confidence, 0.94)
        self.assertEqual(pred_1.raw_label, 'ragdoll')
        self.assertEqual(pred_1.traits, ('blue eyes', 'fluffy'))

        # Key schema 2: breed and confidence percentage
        raw_2 = {'breed': 'persian', 'confidence': 82.5}
        pred_2 = self.acl.translate_breed_prediction(raw_2)
        self.assertIsNotNone(pred_2)
        self.assertEqual(pred_2.breed_name, 'Persian')
        self.assertAlmostEqual(pred_2.confidence, 0.825)

        # Key schema 3: class_name and probability
        raw_3 = {'class_name': 'bengal', 'probability': 0.77}
        pred_3 = self.acl.translate_breed_prediction(raw_3)
        self.assertIsNotNone(pred_3)
        self.assertEqual(pred_3.breed_name, 'Bengal')
        self.assertAlmostEqual(pred_3.confidence, 0.77)

    def test_translate_breed_predictions_list_and_sorting(self):
        payload = {
            'predictions': [
                {'label': 'domestic_shorthair', 'score': 0.40},
                {'label': 'siamese', 'score': 0.92},
                {'label': 'abyssinian', 'score': 0.15},
            ]
        }
        results = self.acl.translate_breed_predictions(payload)
        self.assertEqual(len(results), 3)
        # Should be sorted by confidence descending
        self.assertEqual(results[0].breed_name, 'Siamese')
        self.assertEqual(results[1].breed_name, 'Domestic Shorthair')
        self.assertEqual(results[2].breed_name, 'Abyssinian')

    def test_translate_visual_match_with_threshold_and_distance(self):
        # Candidate exceeding threshold (0.75)
        raw_match = {
            'target_id': 'rep_100',
            'similarity': 0.88,
            'features': ['white_chest', 'striped_tail'],
            'notes': 'High coat pattern similarity',
        }
        match = self.acl.translate_visual_match(raw_match)
        self.assertIsNotNone(match)
        self.assertEqual(match.target_id, 'rep_100')
        self.assertTrue(match.is_match)
        self.assertAlmostEqual(match.similarity_score, 0.88)
        self.assertIn('white chest', match.matched_features)

        # Candidate below threshold
        raw_below = {'target_id': 'rep_200', 'similarity': 0.65}
        match_below = self.acl.translate_visual_match(raw_below)
        self.assertFalse(match_below.is_match)

        # Candidate providing distance instead of similarity
        raw_dist = {'id': 'rep_300', 'distance': 0.12}
        match_dist = self.acl.translate_visual_match(raw_dist)
        self.assertAlmostEqual(match_dist.similarity_score, 0.88)
        self.assertTrue(match_dist.is_match)

    def test_translate_ai_response_composite(self):
        payload = {
            'model': 'catsos-vision-v2',
            'version': '2.1.0',
            'breeds': [
                {'name': 'maine_coon', 'score': 0.91},
                {'name': 'norwegian_forest', 'score': 0.73},
            ],
            'matches': [
                {'report_id': '456', 'similarity': 0.89, 'matched_features': ['long_hair', 'tufted_ears']},
            ],
            'detected_features': ['long_fur', 'large_size', 'bushy_tail'],
        }
        res: AIAnalysisResult = self.acl.translate_ai_response(payload)

        self.assertIsNotNone(res.primary_breed)
        self.assertEqual(res.primary_breed.breed_name, 'Maine Coon')
        self.assertEqual(len(res.top_breeds), 2)
        self.assertEqual(len(res.visual_matches), 1)
        self.assertEqual(res.visual_matches[0].target_id, '456')
        self.assertEqual(res.model_name, 'catsos-vision-v2')
        self.assertEqual(res.model_version, '2.1.0')
        self.assertIn('bushy tail', res.detected_features)

        # Dictionary serialization
        res_dict = res.to_dict()
        self.assertEqual(res_dict['primary_breed']['breed_name'], 'Maine Coon')
        self.assertEqual(res_dict['visual_matches'][0]['target_id'], '456')

    def test_resilience_to_malformed_and_empty_payloads(self):
        # Empty inputs
        self.assertEqual(translate_breed_predictions(None), ())
        self.assertEqual(translate_visual_matches([]), ())
        res_empty = translate_ai_response({})
        self.assertIsNone(res_empty.primary_breed)
        self.assertEqual(res_empty.top_breeds, ())
        self.assertEqual(res_empty.visual_matches, ())

        # Malformed entries within list
        malformed_payload = {
            'predictions': [None, 123, 'not a dict', {'no_name': 1.0}],
            'matches': [None, 456, 'invalid'],
        }
        res_malformed = self.acl.translate_ai_response(malformed_payload)
        # Handled gracefully without raising unhandled errors
        self.assertIsInstance(res_malformed, AIAnalysisResult)
        self.assertEqual(len(res_malformed.visual_matches), 0)
