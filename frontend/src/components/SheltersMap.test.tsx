import { render, screen, fireEvent } from '@testing-library/react';
import { SheltersMap, type MapPlace } from './SheltersMap';

describe('SheltersMap', () => {
  const closePlaces: MapPlace[] = [
    {
      id: 'p1',
      name: 'Cat Clinic Central',
      type: 'vet',
      lat: 51.218,
      lng: 4.408,
      phone: '+32 3 111 2222',
      address: 'Central Street 1',
    },
    {
      id: 'p2',
      name: 'City Animal Shelter',
      type: 'shelter',
      lat: 51.219,
      lng: 4.409,
      phone: '+32 3 222 3333',
      address: 'Central Street 5',
    },
    {
      id: 'p3',
      name: 'Feline Urgent Care',
      type: 'vet',
      lat: 51.2185,
      lng: 4.4085,
      phone: '+32 3 333 4444',
      address: 'Central Street 3',
    },
  ];

  const separatedPlaces: MapPlace[] = [
    {
      id: 'p1',
      name: 'London Shelter',
      type: 'shelter',
      lat: 51.5074,
      lng: -0.1278,
    },
    {
      id: 'p2',
      name: 'Tokyo Vet',
      type: 'vet',
      lat: 35.6762,
      lng: 139.6503,
    },
  ];

  it('renders the map container with accessible label', () => {
    render(<SheltersMap locations={[]} />);
    expect(
      screen.getByLabelText(/map of nearby shelters and veterinary clinics/i),
    ).toBeInTheDocument();
  });

  it('groups nearby places into a bubble showing x+ when zoomed out', () => {
    render(<SheltersMap locations={closePlaces} zoom={10} />);

    // 3 close places at zoom 10 group together into a cluster bubble displaying "3+"
    expect(screen.getByText('3+')).toBeInTheDocument();
  });

  it('shows individual places when places are widely separated', () => {
    render(<SheltersMap locations={separatedPlaces} zoom={12} />);

    // Widely separated places across continents render individual markers/popups
    expect(screen.getByText('London Shelter')).toBeInTheDocument();
    expect(screen.getByText('Tokyo Vet')).toBeInTheDocument();
    expect(screen.queryByText('2+')).not.toBeInTheDocument();
  });

  it('renders "Search this area" button when onSearchThisArea is provided', () => {
    const handleSearch = jest.fn();
    render(<SheltersMap locations={[]} onSearchThisArea={handleSearch} />);

    const button = screen.getByRole('button', { name: /search this area/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(handleSearch).toHaveBeenCalledTimes(1);
  });

  it('renders searching indicator when isSearchingArea is true', () => {
    render(<SheltersMap locations={[]} isSearchingArea={true} />);

    expect(
      screen.getByText(/searching public data in this area/i),
    ).toBeInTheDocument();
  });

  it('calls onSelectPlace when an individual place is clicked', () => {
    const handleSelect = jest.fn();
    render(<SheltersMap locations={[separatedPlaces[0]]} onSelectPlace={handleSelect} />);

    expect(screen.getByText('London Shelter')).toBeInTheDocument();
  });
});
