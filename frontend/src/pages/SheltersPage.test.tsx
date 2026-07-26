import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MOCK_LOCATIONS } from '../data/shelters';
import { fetchNearbyHelp } from '../services/nearbyHelpApi';
import { renderWithProviders } from '../test/renderWithProviders';
import { SheltersPage } from './SheltersPage';

const nearbyHelpResponse = {
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
};

function nearbyHelpMock() {
  return fetchNearbyHelp as jest.Mock;
}

beforeEach(() => {
  nearbyHelpMock().mockReset().mockResolvedValue(nearbyHelpResponse);
});

describe('SheltersPage', () => {
  it('renders its public-safety warning and loads places from the API', async () => {
    renderWithProviders(<SheltersPage />);

    expect(screen.getByRole('note', { name: /nearby help data warning/i })).toHaveTextContent(
      /data may be incomplete\. call before visiting\./i,
    );
    expect(await screen.findByRole('heading', { name: MOCK_LOCATIONS[0].name })).toBeInTheDocument();
    expect(nearbyHelpMock()).toHaveBeenCalledWith(51.2194, 4.4025, 15);
  });

  it('filters loaded places by name and address', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);
    await screen.findByRole('heading', { name: MOCK_LOCATIONS[0].name });

    const search = screen.getByRole('textbox', { name: /search/i });
    await user.type(search, 'Borgerhout');

    expect(screen.getByRole('heading', { name: /north side pet hospital/i })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);
  });

  it('combines type and text filters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);
    await screen.findByRole('heading', { name: MOCK_LOCATIONS[0].name });

    await user.click(screen.getByRole('button', { name: /^vets$/i }));
    await user.type(screen.getByRole('textbox', { name: /search/i }), 'Paws');

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^vets$/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a clear empty state when no place matches', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);
    await screen.findByRole('heading', { name: MOCK_LOCATIONS[0].name });

    await user.type(screen.getByRole('textbox', { name: /search/i }), 'xyznotaplace');

    expect(screen.getByText(/no results match your search/i)).toBeInTheDocument();
  });

  it('shows a safe error state when the backend lookup fails', async () => {
    nearbyHelpMock().mockRejectedValueOnce(new Error('provider details must stay private'));

    renderWithProviders(<SheltersPage />);

    expect(await screen.findByText(/could not load nearby places/i)).toBeInTheDocument();
    expect(screen.queryByText(/provider details must stay private/i)).not.toBeInTheDocument();
  });

  it('paginates a long result set without another provider request', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheltersPage />);
    await screen.findByRole('heading', { name: MOCK_LOCATIONS[0].name });

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(6);
    await user.click(screen.getByRole('button', { name: /load more places/i }));

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(MOCK_LOCATIONS.length);
    expect(nearbyHelpMock()).toHaveBeenCalledTimes(1);
  });
});
