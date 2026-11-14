import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../test/renderWithProviders';
import { SightingsMapSearchPage, formatRoundedStat } from './SightingsMapSearchPage';
import { fetchPublicStats, fetchTrendingNearby } from '../services/reportsApi';

jest.mock('../services/reportsApi', () => ({
  fetchPublicStats: jest.fn(),
  fetchTrendingNearby: jest.fn(),
}));

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/map', search: '', hash: '', key: 'default' }),
}));

const DEFAULT_TRENDING_ITEMS = [
  { id: '1', label: 'Brooklyn, NY', query: 'Brooklyn, NY', count: 3, distance_km: 2.1, lat: 40.6782, lng: -73.9442 },
  { id: '2', label: 'Portland, OR', query: 'Portland, OR', count: 2, distance_km: 5.4, lat: 45.5152, lng: -122.6784 },
  { id: '3', label: 'Austin, TX', query: 'Austin, TX', count: 1, distance_km: 8.7, lat: 30.2672, lng: -97.7431 },
  { id: '4', label: 'London, UK', query: 'London, UK', count: 4, distance_km: 12.3, lat: 51.5074, lng: -0.1278 },
];

beforeEach(() => {
  jest.clearAllMocks();
  (fetchPublicStats as jest.Mock).mockResolvedValue({
    active_sightings: 0,
    cats_reunited: 0,
    community_members: 0,
  });
  (fetchTrendingNearby as jest.Mock).mockResolvedValue(DEFAULT_TRENDING_ITEMS);
});

afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});


async function renderAndWait() {
  const view = renderWithProviders(<SightingsMapSearchPage />);
  await screen.findByRole('button', { name: /brooklyn/i });
  return view;
}

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('SightingsMapSearchPage — rendering', () => {
  it('renders the main heading', async () => {
    await renderAndWait();
    expect(
      screen.getByRole('heading', { name: /find sightings in your area/i }),
    ).toBeInTheDocument();
  });

  it('renders the subtitle', async () => {
    await renderAndWait();
    expect(screen.getByText(/enter your city or zip code/i)).toBeInTheDocument();
  });

  it('renders the search input', async () => {
    await renderAndWait();
    expect(screen.getByRole('textbox', { name: /search sightings/i })).toBeInTheDocument();
  });

  it('renders the "Search Map" submit button', async () => {
    await renderAndWait();
    expect(screen.getByRole('button', { name: /search map/i })).toBeInTheDocument();
  });

  it('renders dynamic trending location buttons with counts', async () => {
    await renderAndWait();
    expect(screen.getByRole('button', { name: /brooklyn/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /portland/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /austin/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /london/i })).toBeInTheDocument();
  });

  it('renders the Active Sightings stat', async () => {
    await renderAndWait();
    expect(screen.getByText(/active sightings/i)).toBeInTheDocument();
  });

  it('renders the Cats Reunited stat', async () => {
    await renderAndWait();
    expect(screen.getByText(/cats reunited/i)).toBeInTheDocument();
  });

  it('renders the Community Members stat', async () => {
    await renderAndWait();
    expect(screen.getByText(/community members/i)).toBeInTheDocument();
  });
});


// ─── Search navigation ────────────────────────────────────────────────────────

describe('SightingsMapSearchPage — search', () => {
  it('navigates to /map/results with the query on form submit', async () => {
    const user = userEvent.setup();
    await renderAndWait();

    await user.type(screen.getByRole('textbox', { name: /search sightings/i }), 'Antwerp');
    await user.click(screen.getByRole('button', { name: /search map/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/map/results?q=Antwerp');
  });

  it('navigates on Enter key press', async () => {
    const user = userEvent.setup();
    await renderAndWait();

    await user.type(screen.getByRole('textbox', { name: /search sightings/i }), 'London{Enter}');

    expect(mockNavigate).toHaveBeenCalledWith('/map/results?q=London');
  });

  it('does not navigate when the search query is empty', async () => {
    const user = userEvent.setup();
    await renderAndWait();

    await user.click(screen.getByRole('button', { name: /search map/i }));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates to the correct URL when a trending button is clicked', async () => {
    const user = userEvent.setup();
    await renderAndWait();

    const button = await screen.findByRole('button', { name: /brooklyn, ny/i });
    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledWith('/map/results?q=Brooklyn%2C%20NY');
  });

  it('encodes special characters in the query', async () => {
    const user = userEvent.setup();
    await renderAndWait();

    await user.type(screen.getByRole('textbox', { name: /search sightings/i }), 'Austin, TX');
    await user.click(screen.getByRole('button', { name: /search map/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/map/results?q=Austin%2C%20TX');
  });
});

// ─── Dynamic Trending Nearby Integration ──────────────────────────────────────

describe('SightingsMapSearchPage — dynamic trending nearby', () => {
  it('displays empty state notice and no fake cities when backend returns 0 trends', async () => {
    (fetchTrendingNearby as jest.Mock).mockResolvedValueOnce([]);

    renderWithProviders(<SightingsMapSearchPage />);

    await waitFor(() => {
      expect(screen.getByText(/no active sightings within 100 km/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /brooklyn/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /portland/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /london/i })).not.toBeInTheDocument();
  });

  it('uses browser geolocation coordinates when available', async () => {
    const mockGetCurrentPosition = jest.fn().mockImplementation((success) =>
      success({
        coords: { latitude: 52.2297, longitude: 21.0122 },
      }),
    );
    Object.defineProperty(global.navigator, 'geolocation', {
      value: { getCurrentPosition: mockGetCurrentPosition },
      configurable: true,
      writable: true,
    });

    renderWithProviders(<SightingsMapSearchPage />);

    await waitFor(() => {
      expect(fetchTrendingNearby).toHaveBeenCalledWith({
        lat: 52.2297,
        lng: 21.0122,
      });
    });
  });

  it('falls back to IP-based lookup when geolocation fails or is denied', async () => {
    const mockGetCurrentPosition = jest.fn().mockImplementation((_success, error) =>
      error(new Error('Permission denied')),
    );
    Object.defineProperty(global.navigator, 'geolocation', {
      value: { getCurrentPosition: mockGetCurrentPosition },
      configurable: true,
      writable: true,
    });

    renderWithProviders(<SightingsMapSearchPage />);

    await waitFor(() => {
      expect(fetchTrendingNearby).toHaveBeenCalledWith();
    });
  });
});


// ─── Stats Formatting & Async Fetching ─────────────────────────────────────────

describe('formatRoundedStat', () => {
  it('returns "0" for 0, negative numbers, null, or undefined', () => {
    expect(formatRoundedStat(0)).toBe('0');
    expect(formatRoundedStat(-5)).toBe('0');
    expect(formatRoundedStat(null)).toBe('0');
    expect(formatRoundedStat(undefined)).toBe('0');
    expect(formatRoundedStat(NaN)).toBe('0');
  });

  it('returns raw value for numbers under 50', () => {
    expect(formatRoundedStat(1)).toBe('1');
    expect(formatRoundedStat(27)).toBe('27');
    expect(formatRoundedStat(49)).toBe('49');
  });

  it('rounds down to nearest ten with + for numbers between 50 and 999', () => {
    expect(formatRoundedStat(50)).toBe('50+');
    expect(formatRoundedStat(87)).toBe('80+');
    expect(formatRoundedStat(850)).toBe('850+');
  });

  it('rounds to k+ for numbers 1000 and above', () => {
    expect(formatRoundedStat(1000)).toBe('1k+');
    expect(formatRoundedStat(1240)).toBe('1.2k+');
    expect(formatRoundedStat(15400)).toBe('15.4k+');
  });
});

describe('SightingsMapSearchPage — public stats integration', () => {
  it('displays real rounded statistics fetched from backend', async () => {
    (fetchPublicStats as jest.Mock).mockResolvedValueOnce({
      active_sightings: 120,
      cats_reunited: 85,
      community_members: 1540,
    });

    renderWithProviders(<SightingsMapSearchPage />);

    await waitFor(() => {
      expect(screen.getByText('120+')).toBeInTheDocument();
      expect(screen.getByText('80+')).toBeInTheDocument();
      expect(screen.getByText('1.5k+')).toBeInTheDocument();
    });
  });

  it('keeps honest zero display when backend reports zero without showing fake numbers', async () => {
    (fetchPublicStats as jest.Mock).mockResolvedValueOnce({
      active_sightings: 0,
      cats_reunited: 0,
      community_members: 0,
    });

    renderWithProviders(<SightingsMapSearchPage />);
    await screen.findByRole('button', { name: /brooklyn/i });

    expect(screen.queryByText('1,240')).not.toBeInTheDocument();
    expect(screen.queryByText('850')).not.toBeInTheDocument();
    expect(screen.queryByText('15k+')).not.toBeInTheDocument();
  });
});

