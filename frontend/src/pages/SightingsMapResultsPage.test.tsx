import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../test/renderWithProviders';
import { SightingsMapResultsPage } from './SightingsMapResultsPage';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/map/results', search: '', hash: '', key: 'default' }),
}));

jest.mock('../services/reportsApi', () => ({
  fetchPublicReports: jest.fn().mockResolvedValue([]),
  fetchOwnedReports: jest.fn().mockResolvedValue([]),
  fetchReportSightings: jest.fn().mockResolvedValue([]),
}));

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    json: jest.fn().mockResolvedValue([{ lat: '51.2194', lon: '4.4025' }]),
  }) as jest.Mock;
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

  it('renders the map (no loading spinner after geocoding resolves)', async () => {
    await renderPage();
    // After geocoding resolves, the map container renders instead of the loading spinner
    expect(screen.queryByText(/progress_activity/)).not.toBeInTheDocument();
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

// ─── Map modes ────────────────────────────────────────────────────────────────

describe('SightingsMapResultsPage — map modes', () => {
  it('defaults to "all" mode (All Missing Cats)', async () => {
    await renderPage();
    // The filter panel is closed by default; open it to inspect mode options
    await userEvent.click(screen.getByRole('button', { name: /filter map/i }));
    // "All Missing Cats" option should be visible in the filter panel
    expect(screen.getByText(/all missing cats/i)).toBeInTheDocument();
  });

  it('shows "Track a Cat" option in the filter panel', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /filter map/i }));
    expect(screen.getByText(/track a cat/i)).toBeInTheDocument();
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
