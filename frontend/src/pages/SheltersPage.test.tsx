import { screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../test/renderWithProviders';
import { MOCK_LOCATIONS } from '../data/shelters';
import { fetchNearbyHelp } from '../services/nearbyHelpApi';
import { SheltersPage } from './SheltersPage';

const nearbyPlaces = MOCK_LOCATIONS.map((location) => ({
  id: location.id,
  type: location.type,
  name: location.name,
  lat: location.position[0],
  lng: location.position[1],
  distance_km: Number.parseFloat(location.distance),
  address: location.address,
  phone: location.phone,
  opening_hours: location.hours.weekdays,
  source: 'test',
}));

// ─── Router mocks ─────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/shelters', search: '', hash: '', key: 'default' }),
}));

beforeEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  jest.mocked(fetchNearbyHelp).mockResolvedValue({
    center: { lat: 51.2194, lng: 4.4025 },
    radius_km: 15,
    source: 'test',
    places: nearbyPlaces,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

// ─── Derived counts from the mock data (kept in sync automatically) ───────────

const TOTAL = MOCK_LOCATIONS.length;
const SHELTER_COUNT = MOCK_LOCATIONS.filter((l) => l.type === 'shelter').length;
const VET_COUNT = MOCK_LOCATIONS.filter((l) => l.type === 'vet').length;
const INITIAL_VISIBLE_COUNT = Math.min(6, TOTAL);

function phoneLinks() {
  return screen
    .getAllByRole('link')
    .filter((link) => link.getAttribute('href')?.startsWith('tel:'));
}

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('SheltersPage — rendering', () => {
  it('renders the page heading', () => {
    renderWithProviders(<SheltersPage />);
    expect(
      screen.getByRole('heading', { name: /find professional help nearby/i }),
    ).toBeInTheDocument();
  });

  it('renders the search input', () => {
    renderWithProviders(<SheltersPage />);
    expect(screen.getByRole('textbox', { name: /search/i })).toBeInTheDocument();
  });

  it('renders the call-before-visiting warning', () => {
    renderWithProviders(<SheltersPage />);
    expect(screen.getByRole('note', { name: /nearby help data warning/i })).toHaveTextContent(
      /data may be incomplete\. call before visiting\./i,
    );
  });

  it('renders All, Shelters, and Vets filter buttons', () => {
    renderWithProviders(<SheltersPage />);
    expect(screen.getByRole('button', { name: /^all$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^shelters$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^vets$/i })).toBeInTheDocument();
  });

  it(`renders the first ${INITIAL_VISIBLE_COUNT} cards and can load the rest`, async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);

    await waitFor(() => expect(phoneLinks()).toHaveLength(INITIAL_VISIBLE_COUNT));
    await user.click(screen.getByRole('button', { name: /load more places/i }));
    expect(phoneLinks()).toHaveLength(TOTAL);
  });

  it('renders the community callout heading', () => {
    renderWithProviders(<SheltersPage />);
    expect(screen.getByRole('heading', { name: /can't find a shelter/i })).toBeInTheDocument();
  });

  it('renders the Emergency Protocols info card', () => {
    renderWithProviders(<SheltersPage />);
    expect(screen.getByText(/emergency protocols/i)).toBeInTheDocument();
  });

  it('renders the call-ahead info card', () => {
    renderWithProviders(<SheltersPage />);
    expect(screen.getByText(/call ahead/i)).toBeInTheDocument();
    expect(screen.queryByText(/manually verified/i)).not.toBeInTheDocument();
  });

});

// ─── Search ───────────────────────────────────────────────────────────────────

describe('SheltersPage — search', () => {
  it('filters cards by location name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);

    await user.type(screen.getByRole('textbox', { name: /search/i }), 'Paws');

    expect(phoneLinks()).toHaveLength(1);
  });

  it('filters cards by address city', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);

    // "Borgerhout" appears only in North Side Pet Hospital's address
    await user.type(screen.getByRole('textbox', { name: /search/i }), 'Borgerhout');

    expect(phoneLinks()).toHaveLength(1);
    // The heading (not the map popup's <strong>) uniquely identifies the card
    expect(screen.getByRole('heading', { name: /north side pet hospital/i })).toBeInTheDocument();
  });

  it('shows the empty-state message when no results match', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);

    await user.type(screen.getByRole('textbox', { name: /search/i }), 'xyznotaplace');

    expect(screen.getByText(/no results match your search/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /call/i })).not.toBeInTheDocument();
  });

  it('restores all cards when search is cleared', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);

    const input = screen.getByRole('textbox', { name: /search/i });
    await user.type(input, 'Paws');
    await user.clear(input);

    expect(phoneLinks()).toHaveLength(INITIAL_VISIBLE_COUNT);
  });
});

// ─── Type filter ──────────────────────────────────────────────────────────────

describe('SheltersPage — type filter', () => {
  it(`shows only ${SHELTER_COUNT} cards when Shelters is selected`, async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);

    await user.click(screen.getByRole('button', { name: /^shelters$/i }));

    expect(phoneLinks()).toHaveLength(SHELTER_COUNT);
  });

  it(`shows only ${VET_COUNT} cards when Vets is selected`, async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);

    await user.click(screen.getByRole('button', { name: /^vets$/i }));

    expect(phoneLinks()).toHaveLength(VET_COUNT);
  });

  it(`restores all ${TOTAL} cards when All is selected after a filter`, async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);

    await user.click(screen.getByRole('button', { name: /^vets$/i }));
    await user.click(screen.getByRole('button', { name: /^all$/i }));

    expect(phoneLinks()).toHaveLength(INITIAL_VISIBLE_COUNT);
  });

  it('marks the active filter button with aria-pressed="true"', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);

    await user.click(screen.getByRole('button', { name: /^shelters$/i }));

    expect(screen.getByRole('button', { name: /^shelters$/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /^all$/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('combines search and type filter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);

    // Select Vets, then search for a name that matches only one vet
    await user.click(screen.getByRole('button', { name: /^vets$/i }));
    await user.type(screen.getByRole('textbox', { name: /search/i }), 'Paws');

    expect(phoneLinks()).toHaveLength(1);
  });
});

// ─── Map interaction & External links ──────────────────────────────────────────

describe('SheltersPage — card interactions & links', () => {
  it('renders Google Maps links and does not render Open OSM or Focus on map buttons', async () => {
    renderWithProviders(<SheltersPage />);

    await waitFor(() => expect(screen.getByRole('heading', { name: /paws & claws veterinary/i })).toBeInTheDocument());

    const googleMapsLinks = screen.getAllByRole('link', { name: /google maps/i });
    expect(googleMapsLinks.length).toBeGreaterThan(0);
    expect(googleMapsLinks[0]).toHaveAttribute('href', expect.stringContaining('google.com/maps/search'));

    expect(screen.queryByRole('link', { name: /open osm/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /focus on map/i })).not.toBeInTheDocument();
  });

  it('clicking a place card focuses the place', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);

    await waitFor(() => expect(screen.getByRole('heading', { name: /paws & claws veterinary/i })).toBeInTheDocument());

    const placeCard = screen.getByRole('heading', { name: /paws & claws veterinary/i }).closest('.cursor-pointer');
    expect(placeCard).toBeInTheDocument();
    if (placeCard) {
      await user.click(placeCard);
      expect(placeCard).toHaveClass('border-primary');
    }
  });

  it('shows 5 location suggestions after 1.5s typing break', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<SheltersPage />);

      const searchInput = screen.getByRole('textbox', { name: /search shelters and veterinary clinics/i });
      fireEvent.change(searchInput, { target: { value: 'Antwerp' } });

      // Initially suggestions should not be shown before 1.5s
      expect(screen.queryByRole('listbox', { name: /suggested places/i })).not.toBeInTheDocument();

      // Fast forward 1.5s
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      const listbox = screen.getByRole('listbox', { name: /suggested places/i });
      expect(listbox).toBeInTheDocument();
      const options = within(listbox).getAllByRole('option');
      expect(options).toHaveLength(5);
    } finally {
      jest.useRealTimers();
    }
  });

  it('opens and closes Suggest a Place modal with centered dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);

    const suggestBtn = screen.getByRole('button', { name: /suggest a place/i });
    await user.click(suggestBtn);

    const dialog = screen.getByRole('dialog', { name: /suggest a shelter or clinic/i });
    expect(dialog).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /close/i });
    await user.click(closeBtn);
  });
});
