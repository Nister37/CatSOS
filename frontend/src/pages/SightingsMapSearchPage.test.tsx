import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../test/renderWithProviders';
import { SightingsMapSearchPage } from './SightingsMapSearchPage';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/map', search: '', hash: '', key: 'default' }),
}));

beforeEach(() => jest.clearAllMocks());

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('SightingsMapSearchPage — rendering', () => {
  it('renders the main heading', () => {
    renderWithProviders(<SightingsMapSearchPage />);
    expect(
      screen.getByRole('heading', { name: /find sightings in your area/i }),
    ).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    renderWithProviders(<SightingsMapSearchPage />);
    expect(screen.getByText(/enter your city or zip code/i)).toBeInTheDocument();
  });

  it('renders the search input', () => {
    renderWithProviders(<SightingsMapSearchPage />);
    expect(screen.getByRole('textbox', { name: /search location/i })).toBeInTheDocument();
  });

  it('renders the "Search Map" submit button', () => {
    renderWithProviders(<SightingsMapSearchPage />);
    expect(screen.getByRole('button', { name: /search map/i })).toBeInTheDocument();
  });

  it('renders all 4 trending location buttons', () => {
    renderWithProviders(<SightingsMapSearchPage />);
    expect(screen.getByRole('button', { name: /brooklyn/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /portland/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /austin/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /london/i })).toBeInTheDocument();
  });

  it('renders the Active Sightings stat', () => {
    renderWithProviders(<SightingsMapSearchPage />);
    expect(screen.getByText(/active sightings/i)).toBeInTheDocument();
  });

  it('renders the Cats Reunited stat', () => {
    renderWithProviders(<SightingsMapSearchPage />);
    expect(screen.getByText(/cats reunited/i)).toBeInTheDocument();
  });

  it('renders the Community Members stat', () => {
    renderWithProviders(<SightingsMapSearchPage />);
    expect(screen.getByText(/community members/i)).toBeInTheDocument();
  });
});

// ─── Search navigation ────────────────────────────────────────────────────────

describe('SightingsMapSearchPage — search', () => {
  it('navigates to /map/results with the query on form submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SightingsMapSearchPage />);

    await user.type(screen.getByRole('textbox', { name: /search location/i }), 'Antwerp');
    await user.click(screen.getByRole('button', { name: /search map/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/map/results?q=Antwerp');
  });

  it('navigates on Enter key press', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SightingsMapSearchPage />);

    await user.type(screen.getByRole('textbox', { name: /search location/i }), 'London{Enter}');

    expect(mockNavigate).toHaveBeenCalledWith('/map/results?q=London');
  });

  it('does not navigate when the search query is empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SightingsMapSearchPage />);

    await user.click(screen.getByRole('button', { name: /search map/i }));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates to the correct URL when a trending button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SightingsMapSearchPage />);

    await user.click(screen.getByRole('button', { name: /brooklyn, ny/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/map/results?q=Brooklyn%2C%20NY');
  });

  it('encodes special characters in the query', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SightingsMapSearchPage />);

    await user.type(screen.getByRole('textbox', { name: /search location/i }), 'Austin, TX');
    await user.click(screen.getByRole('button', { name: /search map/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/map/results?q=Austin%2C%20TX');
  });
});
