import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../test/renderWithProviders';
import { MOCK_SIGHTINGS } from '../data/sightings';
import { SightingsMapResultsPage } from './SightingsMapResultsPage';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/map/results', search: '', hash: '', key: 'default' }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    json: jest.fn().mockResolvedValue([{ lat: '51.2194', lon: '4.4025' }]),
  }) as jest.Mock;
  // jsdom does not implement scrollBy — stub it out so scroll-button tests don't throw
  HTMLElement.prototype.scrollBy = jest.fn();
});

afterEach(() => jest.restoreAllMocks());

// Renders the page and flushes the async geocoding fetch before returning.
async function renderPage(route = '/map/results?q=Antwerp') {
  renderWithProviders(<SightingsMapResultsPage />, { route });
  await act(async () => {});
}

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('SightingsMapResultsPage — rendering', () => {
  it('renders the page heading', async () => {
    await renderPage();
    expect(
      screen.getByRole('heading', { name: /active sightings map/i }),
    ).toBeInTheDocument();
  });

  it('shows the searched location in the live badge', async () => {
    await renderPage();
    expect(screen.getByText(/live in antwerp/i)).toBeInTheDocument();
  });

  it('falls back to "your area" in the badge when no query is provided', async () => {
    await renderPage('/map/results');
    expect(screen.getByText(/live in your area/i)).toBeInTheDocument();
  });

  it('renders the Filter Map button', async () => {
    await renderPage();
    expect(screen.getByRole('button', { name: /filter map/i })).toBeInTheDocument();
  });

  it('renders the Share Map button', async () => {
    await renderPage();
    expect(screen.getByRole('button', { name: /share map/i })).toBeInTheDocument();
  });

  it(`renders a "View Details" button for each of the ${MOCK_SIGHTINGS.length} mock sightings`, async () => {
    await renderPage();
    expect(screen.getAllByRole('button', { name: /view details/i })).toHaveLength(
      MOCK_SIGHTINGS.length,
    );
  });

  it('renders all mock sighting cat names in the feed', async () => {
    await renderPage();
    // Each name appears at least once in the feed card (may also appear in the
    // mocked Leaflet Popup, so we use getAllByText and check length >= 1).
    MOCK_SIGHTINGS.forEach((s) => {
      expect(screen.getAllByText(s.cat_name).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders the scroll left button for the feed', async () => {
    await renderPage();
    expect(screen.getByRole('button', { name: /scroll left/i })).toBeInTheDocument();
  });

  it('renders the scroll right button for the feed', async () => {
    await renderPage();
    expect(screen.getByRole('button', { name: /scroll right/i })).toBeInTheDocument();
  });

  it('renders the CTA heading', async () => {
    await renderPage();
    expect(
      screen.getByRole('heading', { name: /help us grow the safety network/i }),
    ).toBeInTheDocument();
  });

  it('"Post a Sighting" link points to /report-sighting', async () => {
    await renderPage();
    expect(screen.getByRole('link', { name: /post a sighting/i })).toHaveAttribute(
      'href',
      '/report-sighting',
    );
  });
});

// ─── Geocoding fetch ──────────────────────────────────────────────────────────

describe('SightingsMapResultsPage — geocoding', () => {
  it('calls the Nominatim API with the search query', async () => {
    await renderPage();
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('Antwerp'));
  });

  it('does not call fetch when no query is provided', async () => {
    await renderPage('/map/results');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ─── Feed scroll ──────────────────────────────────────────────────────────────

describe('SightingsMapResultsPage — feed scroll', () => {
  it('scroll buttons are present and clickable without throwing', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('button', { name: /scroll right/i }));
    await user.click(screen.getByRole('button', { name: /scroll left/i }));
  });
});
