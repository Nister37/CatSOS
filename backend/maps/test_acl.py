from django.test import SimpleTestCase

from maps.acl import (
    Coordinate,
    Location,
    MapsAntiCorruptionLayer,
    extract_coordinate,
    translate_geocoding_result,
    translate_osm_element,
    translate_places,
)


class MapsACLTests(SimpleTestCase):
    def setUp(self):
        self.acl = MapsAntiCorruptionLayer()
        self.warsaw = Coordinate(latitude=52.2297, longitude=21.0122)

    def test_coordinate_validation_and_methods(self):
        coord = Coordinate(52.229675, '21.012228')
        self.assertEqual(coord.latitude, 52.229675)
        self.assertEqual(coord.longitude, 21.012228)
        self.assertEqual(coord.as_tuple(), (52.229675, 21.012228))
        self.assertEqual(coord.to_dict(), {'latitude': 52.229675, 'longitude': 21.012228})

        # Out-of-bounds latitude
        with self.assertRaises(ValueError):
            Coordinate(95.0, 20.0)

        # Out-of-bounds longitude
        with self.assertRaises(ValueError):
            Coordinate(50.0, 190.0)

        # Non-numeric
        with self.assertRaises(ValueError):
            Coordinate('invalid', 20.0)

        # Boolean rejected
        with self.assertRaises(ValueError):
            Coordinate(True, False)

        # Non-finite rejected
        with self.assertRaises(ValueError):
            Coordinate(float('nan'), 20.0)

    def test_coordinate_haversine_distance(self):
        # Warsaw to Krakow (~252 km)
        krakow = Coordinate(50.0647, 19.9450)
        dist = self.warsaw.distance_to(krakow)
        self.assertGreater(dist, 240.0)
        self.assertLess(dist, 260.0)

        # Same point distance is 0
        self.assertAlmostEqual(self.warsaw.distance_to(self.warsaw), 0.0)

    def test_location_display_address_and_serialization(self):
        loc = Location(
            coordinate=self.warsaw,
            name='Central Vet Clinic',
            street='Marszalkowska',
            house_number='10',
            city='Warsaw',
            postal_code='00-001',
            country='Poland',
            place_type='vet',
            osm_id=123456,
            osm_type='node',
            phone='+48220000000',
        )
        self.assertEqual(loc.display_address, 'Marszalkowska 10, Warsaw, 00-001, Poland')
        d = loc.to_dict()
        self.assertEqual(d['coordinate']['latitude'], 52.2297)
        self.assertEqual(d['place_type'], 'vet')
        self.assertEqual(d['osm_id'], 123456)

    def test_translate_osm_element_node(self):
        element = {
            'type': 'node',
            'id': 1001,
            'lat': 52.2300,
            'lon': 21.0100,
            'tags': {
                'name': 'Happy Paws Clinic',
                'amenity': 'veterinary',
                'addr:street': 'Nowy Swiat',
                'addr:housenumber': '15',
                'addr:city': 'Warszawa',
                'addr:postcode': '00-029',
                'phone': '+48 22 111 22 33',
                'website': 'https://happypaws.test',
            },
        }
        loc = self.acl.translate_osm_element(element, origin=self.warsaw)
        self.assertIsNotNone(loc)
        self.assertEqual(loc.name, 'Happy Paws Clinic')
        self.assertEqual(loc.place_type, 'vet')
        self.assertEqual(loc.street, 'Nowy Swiat')
        self.assertEqual(loc.house_number, '15')
        self.assertEqual(loc.city, 'Warszawa')
        self.assertEqual(loc.postal_code, '00-029')
        self.assertEqual(loc.phone, '+48 22 111 22 33')
        self.assertEqual(loc.website, 'https://happypaws.test')
        self.assertIsNotNone(loc.distance_km)
        self.assertGreater(loc.quality_score, 0)

    def test_translate_osm_element_way_with_center(self):
        element = {
            'type': 'way',
            'id': 2002,
            'center': {'lat': 52.2350, 'lon': 21.0150},
            'tags': {
                'name': 'Kocia Kawiarnia Mruczek',
                'amenity': 'cafe',
                'cuisine': 'cat_cafe',
                'addr:street': 'Krakowskie Przedmiescie',
            },
        }
        loc = self.acl.translate_osm_element(element)
        self.assertIsNotNone(loc)
        self.assertEqual(loc.coordinate.latitude, 52.235)
        self.assertEqual(loc.coordinate.longitude, 21.015)
        self.assertEqual(loc.place_type, 'cat_cafe')
        self.assertEqual(loc.osm_type, 'way')
        self.assertEqual(loc.osm_id, 2002)

    def test_translate_geocoding_result_nominatim(self):
        nominatim_payload = {
            'place_id': 998877,
            'osm_type': 'node',
            'osm_id': 554433,
            'lat': '52.2400',
            'lon': '21.0200',
            'display_name': 'Schronisko Na Paluchu, Paluch 2, 02-197 Warszawa, Poland',
            'type': 'animal_shelter',
            'address': {
                'amenity': 'Schronisko Na Paluchu',
                'road': 'Paluch',
                'house_number': '2',
                'city': 'Warszawa',
                'postcode': '02-197',
                'country': 'Poland',
            },
        }
        loc = self.acl.translate_geocoding_result(nominatim_payload, origin=self.warsaw)
        self.assertIsNotNone(loc)
        self.assertEqual(loc.name, 'Schronisko Na Paluchu')
        self.assertEqual(loc.place_type, 'shelter')
        self.assertEqual(loc.street, 'Paluch')
        self.assertEqual(loc.house_number, '2')
        self.assertEqual(loc.city, 'Warszawa')
        self.assertEqual(loc.postal_code, '02-197')
        self.assertEqual(loc.country, 'Poland')
        self.assertAlmostEqual(loc.coordinate.latitude, 52.24)
        self.assertAlmostEqual(loc.coordinate.longitude, 21.02)
        self.assertIsNotNone(loc.distance_km)

    def test_translate_places_deduplication_and_filtering(self):
        elements = [
            {'type': 'node', 'id': 1, 'lat': 52.23, 'lon': 21.01, 'tags': {'name': 'Clinic A'}},
            {'type': 'node', 'id': 1, 'lat': 52.23, 'lon': 21.01, 'tags': {'name': 'Clinic A Duplicate'}},
            {'type': 'node', 'id': 2, 'lat': None, 'lon': None},  # Invalid
            {'type': 'way', 'id': 3, 'center': {'lat': 52.24, 'lon': 21.02}, 'tags': {'name': 'Shelter B'}},
        ]
        places = self.acl.translate_places(elements)
        self.assertEqual(len(places), 2)
        self.assertEqual(places[0].osm_id, 1)
        self.assertEqual(places[1].osm_id, 3)

    def test_extract_coordinate_formats(self):
        self.assertEqual(extract_coordinate((52.0, 21.0)), Coordinate(52.0, 21.0))
        self.assertEqual(extract_coordinate({'lat': 52.0, 'lng': 21.0}), Coordinate(52.0, 21.0))
        self.assertEqual(extract_coordinate({'latitude': 52.0, 'longitude': 21.0}), Coordinate(52.0, 21.0))
        with self.assertRaises(ValueError):
            extract_coordinate('not-a-coord')

    def test_translate_osm_element_null_tags_and_invalid_coords(self):
        # Element with null tags
        loc_null_tags = self.acl.translate_osm_element({'type': 'node', 'lat': 52.0, 'lon': 21.0, 'tags': None})
        self.assertIsNotNone(loc_null_tags)
        self.assertEqual(loc_null_tags.coordinate.latitude, 52.0)
        self.assertEqual(loc_null_tags.name, '')

        # Element with non-numeric lat string
        loc_invalid = self.acl.translate_osm_element({'type': 'node', 'lat': 'invalid', 'lon': 21.0})
        self.assertIsNone(loc_invalid)

    def test_translate_geocoding_generic_latitude_longitude(self):
        generic_payload = {
            'place_id': 12345,
            'name': 'Animal Rescue Center',
            'latitude': '52.2500',
            'longitude': '21.0300',
            'type': 'shelter',
            'address': {
                'road': 'Dluga',
                'house_number': '5',
                'city': 'Warszawa',
            },
        }
        loc = self.acl.translate_geocoding_result(generic_payload)
        self.assertIsNotNone(loc)
        self.assertEqual(loc.name, 'Animal Rescue Center')
        self.assertEqual(loc.coordinate.latitude, 52.25)
        self.assertEqual(loc.coordinate.longitude, 21.03)
        self.assertEqual(loc.place_type, 'shelter')
