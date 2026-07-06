import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../test/renderWithProviders';
import { MOCK_LOCATIONS } from '../data/shelters';
import { SheltersPage } from './SheltersPage';

// ─── Router mocks ─────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/shelters', search: '', hash: '', key: 'default' }),
}));

beforeEach(() => jest.clearAllMocks());

// ─── Derived counts from the mock data (kept in sync automatically) ───────────

const TOTAL = MOCK_LOCATIONS.length;
const SHELTER_COUNT = MOCK_LOCATIONS.filter((l) => l.type === 'shelter').length;
const VET_COUNT = MOCK_LOCATIONS.filter((l) => l.type === 'vet').length;

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

  it('renders All, Shelters, and Vets filter buttons', () => {
    renderWithProviders(<SheltersPage />);
    expect(screen.getByRole('button', { name: /^all$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^shelters$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^vets$/i })).toBeInTheDocument();
  });

  it(`renders all ${TOTAL} cards on load`, () => {
    renderWithProviders(<SheltersPage />);
    expect(screen.getAllByRole('button', { name: /call now/i })).toHaveLength(TOTAL);
  });

  it('renders the community callout heading', () => {
    renderWithProviders(<SheltersPage />);
    expect(screen.getByRole('heading', { name: /can't find a shelter/i })).toBeInTheDocument();
  });

  it('renders the Emergency Protocols info card', () => {
    renderWithProviders(<SheltersPage />);
    expect(screen.getByText(/emergency protocols/i)).toBeInTheDocument();
  });

  it('renders the Verified Partners info card', () => {
    renderWithProviders(<SheltersPage />);
    expect(screen.getByText(/verified partners/i)).toBeInTheDocument();
  });

  it('renders the mobile map toggle button', () => {
    renderWithProviders(<SheltersPage />);
    expect(screen.getByRole('button', { name: /view on map/i })).toBeInTheDocument();
  });
});

// ─── Search ───────────────────────────────────────────────────────────────────

describe('SheltersPage — search', () => {
  it('filters cards by location name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);

    await user.type(screen.getByRole('textbox', { name: /search/i }), 'Paws');

    expect(screen.getAllByRole('button', { name: /call now/i })).toHaveLength(1);
  });

  it('filters cards by address city', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);

    // "Borgerhout" appears only in North Side Pet Hospital's address
    await user.type(screen.getByRole('textbox', { name: /search/i }), 'Borgerhout');

    expect(screen.getAllByRole('button', { name: /call now/i })).toHaveLength(1);
    // The heading (not the map popup's <strong>) uniquely identifies the card
    expect(screen.getByRole('heading', { name: /north side pet hospital/i })).toBeInTheDocument();
  });

  it('shows the empty-state message when no results match', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);

    await user.type(screen.getByRole('textbox', { name: /search/i }), 'xyznotaplace');

    expect(screen.getByText(/no results match your search/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /call now/i })).not.toBeInTheDocument();
  });

  it('restores all cards when search is cleared', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);

    const input = screen.getByRole('textbox', { name: /search/i });
    await user.type(input, 'Paws');
    await user.clear(input);

    expect(screen.getAllByRole('button', { name: /call now/i })).toHaveLength(TOTAL);
  });
});

// ─── Type filter ──────────────────────────────────────────────────────────────

describe('SheltersPage — type filter', () => {
  it(`shows only ${SHELTER_COUNT} cards when Shelters is selected`, async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);

    await user.click(screen.getByRole('button', { name: /^shelters$/i }));

    expect(screen.getAllByRole('button', { name: /call now/i })).toHaveLength(SHELTER_COUNT);
  });

  it(`shows only ${VET_COUNT} cards when Vets is selected`, async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);

    await user.click(screen.getByRole('button', { name: /^vets$/i }));

    expect(screen.getAllByRole('button', { name: /call now/i })).toHaveLength(VET_COUNT);
  });

  it(`restores all ${TOTAL} cards when All is selected after a filter`, async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);

    await user.click(screen.getByRole('button', { name: /^vets$/i }));
    await user.click(screen.getByRole('button', { name: /^all$/i }));

    expect(screen.getAllByRole('button', { name: /call now/i })).toHaveLength(TOTAL);
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

    expect(screen.getAllByRole('button', { name: /call now/i })).toHaveLength(1);
  });
});

// ─── Mobile map toggle ────────────────────────────────────────────────────────

describe('SheltersPage — mobile map toggle', () => {
  it('mobile map overlay is not in the DOM before the toggle is clicked', () => {
    renderWithProviders(<SheltersPage />);
    // Desktop overlay says "within 10 km of your location"; mobile says "within 10 km" (exact).
    // Before clicking, the mobile map is not rendered so "within 10 km" (exact) is absent.
    expect(screen.queryByText('within 10 km')).not.toBeInTheDocument();
  });

  it('shows the mobile map overlay after clicking "View on map"', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);

    await user.click(screen.getByRole('button', { name: /view on map/i }));

    // Mobile overlay unique text (desktop says "within 10 km of your location")
    expect(screen.getByText('within 10 km')).toBeInTheDocument();
  });

  it('button label changes to "Hide map" when the map is open', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);

    await user.click(screen.getByRole('button', { name: /view on map/i }));

    expect(screen.getByRole('button', { name: /hide map/i })).toBeInTheDocument();
  });

  it('hides the mobile map overlay again when "Hide map" is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);

    await user.click(screen.getByRole('button', { name: /view on map/i }));
    await user.click(screen.getByRole('button', { name: /hide map/i }));

    expect(screen.queryByText('within 10 km')).not.toBeInTheDocument();
  });
});
