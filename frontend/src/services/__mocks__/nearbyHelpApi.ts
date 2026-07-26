import { MOCK_LOCATIONS } from '../../data/shelters';

export const fetchNearbyHelp = jest.fn().mockResolvedValue({
  center: { lat: 51.2194, lng: 4.4025 },
  radius_km: 15,
  source: 'test',
  warning: 'Data may be incomplete. Call before visiting.',
  places: MOCK_LOCATIONS.map((place) => ({
    id: place.id,
    type: place.type,
    name: place.name,
    lat: place.position[0],
    lng: place.position[1],
    distance_km: Number.parseFloat(place.distance),
    address: place.address,
    phone: place.phone,
    source: 'test',
  })),
});
