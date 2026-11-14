export { buildGoogleMapsUrl, isSafeHttpUrl } from '../nearbyHelpApi';

export const fetchNearbyHelp = jest.fn().mockResolvedValue({
  center: { lat: 51.2194, lng: 4.4025 },
  radius_km: 15,
  source: 'test',
  places: [],
});
