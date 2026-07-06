import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../test/renderWithProviders';
import type { ShelterLocation } from '../data/shelters';
import { ShelterCard } from './ShelterCard';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const openVet: ShelterLocation = {
  id: 't1',
  name: 'Happy Paws Vet',
  type: 'vet',
  address: 'Koningin Astridplein 1, 2018 Antwerp',
  distance: '2.0 km',
  phone: '+32 3 999 0000',
  email: 'clinic@happypaws.be',
  hours: { weekdays: '8:00 – 19:00', saturday: '9:00 – 13:00', sunday: 'Closed' },
  description: 'A friendly vet clinic for feline emergencies.',
  isOpen: true,
  position: [51.22, 4.41],
  imageUrl: 'https://example.com/vet.jpg',
};

const closedShelter: ShelterLocation = {
  ...openVet,
  id: 't2',
  name: 'City Cat Shelter',
  type: 'shelter',
  isOpen: false,
  email: 'help@citycatshelter.be',
  phone: '+32 3 111 2222',
};

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('ShelterCard — rendering', () => {
  it('renders the location name', () => {
    renderWithProviders(<ShelterCard location={openVet} />);
    expect(screen.getByRole('heading', { name: /happy paws vet/i })).toBeInTheDocument();
  });

  it('renders "Veterinary" badge for a vet', () => {
    renderWithProviders(<ShelterCard location={openVet} />);
    expect(screen.getByText(/veterinary/i)).toBeInTheDocument();
  });

  it('renders "Shelter" badge for a shelter', () => {
    renderWithProviders(<ShelterCard location={closedShelter} />);
    expect(screen.getByText(/^shelter$/i)).toBeInTheDocument();
  });

  it('renders "Open Now" for an open location', () => {
    renderWithProviders(<ShelterCard location={openVet} />);
    expect(screen.getByText(/open now/i)).toBeInTheDocument();
  });

  it('renders "Closed" for a closed location', () => {
    renderWithProviders(<ShelterCard location={closedShelter} />);
    expect(screen.getByText(/^closed$/i)).toBeInTheDocument();
  });

  it('renders the distance', () => {
    renderWithProviders(<ShelterCard location={openVet} />);
    expect(screen.getByText(/2\.0 km/i)).toBeInTheDocument();
  });

  it('renders the description', () => {
    renderWithProviders(<ShelterCard location={openVet} />);
    expect(screen.getByText(/feline emergencies/i)).toBeInTheDocument();
  });

  it('renders both action buttons', () => {
    renderWithProviders(<ShelterCard location={openVet} />);
    expect(screen.getByRole('button', { name: /call now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /details/i })).toBeInTheDocument();
  });

  it('renders no popup on initial mount', () => {
    renderWithProviders(<ShelterCard location={openVet} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// ─── Contact popup ────────────────────────────────────────────────────────────

describe('ShelterCard — contact popup', () => {
  async function openContactPopup(location = openVet) {
    const user = userEvent.setup();
    renderWithProviders(<ShelterCard location={location} />);
    await user.click(screen.getByRole('button', { name: /call now/i }));
    return user;
  }

  it('opens the contact popup when Call Now is clicked', async () => {
    await openContactPopup();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows the location name in the popup header', async () => {
    await openContactPopup();
    // name appears in both the card heading and the popup header
    expect(screen.getAllByText(/happy paws vet/i).length).toBeGreaterThanOrEqual(2);
  });

  it('shows the phone number', async () => {
    await openContactPopup();
    expect(screen.getByText('+32 3 999 0000')).toBeInTheDocument();
  });

  it('shows the email address', async () => {
    await openContactPopup();
    expect(screen.getByText('clinic@happypaws.be')).toBeInTheDocument();
  });

  it('phone "Call" link has the correct tel: href', async () => {
    await openContactPopup();
    const callLinks = screen.getAllByRole('link', { name: /call/i });
    expect(callLinks.some((l) => l.getAttribute('href') === 'tel:+32 3 999 0000')).toBe(true);
  });

  it('email "Email" link has the correct mailto: href', async () => {
    await openContactPopup();
    const emailLink = screen.getByRole('link', { name: /^email$/i });
    expect(emailLink).toHaveAttribute('href', 'mailto:clinic@happypaws.be');
  });

  it('closes when the × button is clicked', async () => {
    const user = await openContactPopup();
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when the Escape key is pressed', async () => {
    const user = await openContactPopup();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when the backdrop is clicked', async () => {
    const user = await openContactPopup();
    // The backdrop is the aria-hidden overlay behind the dialog
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    await user.click(backdrop);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// ─── Details popup ────────────────────────────────────────────────────────────

describe('ShelterCard — details popup', () => {
  async function openDetailsPopup(location = openVet) {
    const user = userEvent.setup();
    renderWithProviders(<ShelterCard location={location} />);
    await user.click(screen.getByRole('button', { name: /details/i }));
    return user;
  }

  it('opens the details popup when Details is clicked', async () => {
    await openDetailsPopup();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows the location name in the popup header', async () => {
    await openDetailsPopup();
    expect(screen.getAllByText(/happy paws vet/i).length).toBeGreaterThanOrEqual(2);
  });

  it('shows the address', async () => {
    await openDetailsPopup();
    expect(screen.getByText(/koningin astridplein 1/i)).toBeInTheDocument();
  });

  it('shows weekday opening hours', async () => {
    await openDetailsPopup();
    expect(screen.getByText(/8:00\s*–\s*19:00/)).toBeInTheDocument();
  });

  it('shows saturday hours', async () => {
    await openDetailsPopup();
    expect(screen.getByText(/9:00\s*–\s*13:00/)).toBeInTheDocument();
  });

  it('shows "Closed" for sunday', async () => {
    await openDetailsPopup();
    // "Closed" in the popup body (not the card's open/closed indicator)
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('closes when the × button is clicked', async () => {
    const user = await openDetailsPopup();
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when the Escape key is pressed', async () => {
    const user = await openDetailsPopup();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when the backdrop is clicked', async () => {
    const user = await openDetailsPopup();
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    await user.click(backdrop);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows all three day-label rows', async () => {
    await openDetailsPopup();
    expect(screen.getByText(/mon\s*[–-]\s*fri/i)).toBeInTheDocument();
    expect(screen.getByText(/saturday/i)).toBeInTheDocument();
    expect(screen.getByText(/sunday/i)).toBeInTheDocument();
  });
});
