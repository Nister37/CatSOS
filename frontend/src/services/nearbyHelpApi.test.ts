import { buildGoogleMapsUrl, fetchNearbyHelp, isSafeHttpUrl } from './nearbyHelpApi';

describe('nearbyHelpApi', () => {
  describe('isSafeHttpUrl', () => {
    it('returns true for valid http and https URLs', () => {
      expect(isSafeHttpUrl('http://example.com')).toBe(true);
      expect(isSafeHttpUrl('https://example.com/clinic')).toBe(true);
      expect(isSafeHttpUrl('  https://example.com  ')).toBe(true);
    });

    it('returns false for unsafe schemes, javascript:, data:, or malformed inputs', () => {
      expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeHttpUrl('data:text/html,bad')).toBe(false);
      expect(isSafeHttpUrl('file:///etc/passwd')).toBe(false);
      expect(isSafeHttpUrl('')).toBe(false);
      expect(isSafeHttpUrl('   ')).toBe(false);
      expect(isSafeHttpUrl(null)).toBe(false);
      expect(isSafeHttpUrl(undefined)).toBe(false);
    });
  });

  describe('buildGoogleMapsUrl', () => {
    it('uses place name and address when both are present', () => {
      const url = buildGoogleMapsUrl({
        name: 'Dierenasiel Antwerpen',
        address: 'Noorderlaan 100, 2030 Antwerpen',
        lat: 51.2467,
        lng: 4.4172,
      });
      expect(url).toBe(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          'Dierenasiel Antwerpen, Noorderlaan 100, 2030 Antwerpen',
        )}`,
      );
    });

    it('falls back to coordinates when address is empty or not provided', () => {
      const url = buildGoogleMapsUrl({
        name: 'Safe Paws Shelter',
        address: null,
        lat: 51.2148,
        lng: 4.4042,
      });
      expect(url).toBe('https://www.google.com/maps/search/?api=1&query=51.2148,4.4042');
    });

    it('falls back to coordinates when name is Unnamed place', () => {
      const url = buildGoogleMapsUrl({
        name: 'Unnamed place',
        address: 'Noorderlaan 100, Antwerpen',
        lat: 51.2467,
        lng: 4.4172,
      });
      expect(url).toBe('https://www.google.com/maps/search/?api=1&query=51.2467,4.4172');
    });

    it('falls back to coordinates when address is generic such as unnamed address or unknown', () => {
      const url1 = buildGoogleMapsUrl({
        name: 'City Vet',
        address: 'unnamed address',
        lat: 51.2467,
        lng: 4.4172,
      });
      expect(url1).toBe('https://www.google.com/maps/search/?api=1&query=51.2467,4.4172');

      const url2 = buildGoogleMapsUrl({
        name: 'City Vet',
        address: 'Unknown',
        lat: 51.2467,
        lng: 4.4172,
      });
      expect(url2).toBe('https://www.google.com/maps/search/?api=1&query=51.2467,4.4172');
    });

    it('falls back to coordinates when neither name nor address is present', () => {
      const url = buildGoogleMapsUrl({
        name: '',
        address: '',
        lat: 51.2148,
        lng: 4.4042,
      });
      expect(url).toBe('https://www.google.com/maps/search/?api=1&query=51.2148,4.4042');
    });

    it('falls back to coordinates when name is null and address is null', () => {
      const url = buildGoogleMapsUrl({
        name: null,
        address: null,
        lat: 52.1706,
        lng: 20.9634,
      });
      expect(url).toBe('https://www.google.com/maps/search/?api=1&query=52.1706,20.9634');
    });
  });

  describe('fetchNearbyHelp', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it('fetches nearby help with lat, lng, radius_km', async () => {
      const mockPayload = {
        center: { lat: 51.2, lng: 4.4 },
        radius_km: 10,
        source: 'osm',
        places: [],
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPayload,
      });

      const res = await fetchNearbyHelp(51.2, 4.4, 10);
      expect(res).toEqual(mockPayload);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/maps/nearby-help/?lat=51.2&lng=4.4&radius_km=10'),
        expect.any(Object),
      );
    });

    it('throws error when response not ok', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: 'Failed' }),
      });

      await expect(fetchNearbyHelp(51.2, 4.4, 10)).rejects.toEqual({ detail: 'Failed' });
    });
  });
});
