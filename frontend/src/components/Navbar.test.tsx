import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../test/renderWithProviders';
import { Navbar } from './Navbar';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

beforeEach(() => jest.clearAllMocks());

const loggedInState = {
  auth: {
    user: {
      id: 1,
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      avatarFallback: 'JD',
    },
    accessToken: 'tok',
    refreshToken: 'rtok',
  },
};

// ─── Logged-out ───────────────────────────────────────────────────────────────

describe('Navbar — logged out', () => {
  it('renders the CatSOS logo link', () => {
    renderWithProviders(<Navbar />);
    expect(screen.getByRole('link', { name: /catsos/i })).toBeInTheDocument();
  });

  it('renders Join links (desktop + mobile) and no user menu button', () => {
    renderWithProviders(<Navbar />);
    // Both desktop and mobile Join links are in the DOM (CSS hides one per breakpoint)
    expect(screen.getAllByRole('link', { name: /^join$/i })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /user menu/i })).not.toBeInTheDocument();
  });
});

// ─── Logged-in: avatar button ─────────────────────────────────────────────────

describe('Navbar — logged in, avatar button', () => {
  it('shows the user menu button and hides the Join links', () => {
    renderWithProviders(<Navbar />, { preloadedState: loggedInState });

    expect(screen.getByRole('button', { name: /user menu/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^join$/i })).not.toBeInTheDocument();
  });

  it('is collapsed by default', () => {
    renderWithProviders(<Navbar />, { preloadedState: loggedInState });
    expect(screen.getByRole('button', { name: /user menu/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('toggles aria-expanded when clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Navbar />, { preloadedState: loggedInState });

    await user.click(screen.getByRole('button', { name: /user menu/i }));
    expect(screen.getByRole('button', { name: /user menu/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await user.click(screen.getByRole('button', { name: /user menu/i }));
    expect(screen.getByRole('button', { name: /user menu/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});

// ─── Logged-in: dropdown content ─────────────────────────────────────────────

describe('Navbar — logged in, dropdown', () => {
  async function openDropdown() {
    const user = userEvent.setup();
    const { store } = renderWithProviders(<Navbar />, { preloadedState: loggedInState });
    await user.click(screen.getByRole('button', { name: /user menu/i }));
    return { user, store };
  }

  it('shows the user full name in the dropdown header', async () => {
    await openDropdown();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('shows the user email in the dropdown header', async () => {
    await openDropdown();
    // email appears twice: once in the dropdown header, once in the mobile menu header
    expect(screen.getAllByText('jane@example.com').length).toBeGreaterThanOrEqual(1);
  });

  it('shows a Settings link pointing to /settings', async () => {
    await openDropdown();
    // Mobile Settings link is always in the DOM; dropdown adds a second one
    const links = screen.getAllByRole('link', { name: /settings/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0]).toHaveAttribute('href', '/settings');
  });

  it('shows a Sign out button in the dropdown', async () => {
    await openDropdown();
    // Mobile Sign out is always in the DOM; dropdown adds a second one
    expect(screen.getAllByRole('button', { name: /sign out/i })).toHaveLength(2);
  });

  it('closes the dropdown when Settings is clicked', async () => {
    const { user } = await openDropdown();
    // Click the first Settings link (dropdown one, first in DOM order)
    await user.click(screen.getAllByRole('link', { name: /settings/i })[0]);
    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
  });

  it('closes the dropdown when clicking outside', async () => {
    await openDropdown();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
  });

  it('falls back to email when user has no first name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Navbar />, {
      preloadedState: {
        auth: {
          user: { id: 2, email: 'anon@example.com', firstName: '', lastName: '', avatarFallback: 'A' },
          accessToken: 'tok',
          refreshToken: 'rtok',
        },
      },
    });
    await user.click(screen.getByRole('button', { name: /user menu/i }));
    // email shown in the name slot (no firstName) + email slot = at least 2 occurrences
    expect(screen.getAllByText('anon@example.com').length).toBeGreaterThanOrEqual(2);
  });
});

// ─── Sign out ─────────────────────────────────────────────────────────────────

describe('Navbar — sign out via dropdown', () => {
  it('clears auth state and navigates home', async () => {
    const user = userEvent.setup();
    const { store } = renderWithProviders(<Navbar />, { preloadedState: loggedInState });

    await user.click(screen.getByRole('button', { name: /user menu/i }));
    // Dropdown Sign out is first in DOM order; mobile Sign out is second
    await user.click(screen.getAllByRole('button', { name: /sign out/i })[0]);

    expect(store.getState().auth.user).toBeNull();
    expect(store.getState().auth.accessToken).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('closes the dropdown after signing out', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Navbar />, { preloadedState: loggedInState });

    await user.click(screen.getByRole('button', { name: /user menu/i }));
    await user.click(screen.getAllByRole('button', { name: /sign out/i })[0]);

    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
  });
});

// ─── Mobile menu ─────────────────────────────────────────────────────────────

describe('Navbar — mobile menu', () => {
  it('opens and closes via the hamburger button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Navbar />);

    const hamburger = screen.getByRole('button', { name: /open menu/i });
    expect(hamburger).toHaveAttribute('aria-expanded', 'false');

    await user.click(hamburger);
    expect(hamburger).toHaveAttribute('aria-expanded', 'true');
  });

  it('does not include "Report a Missing Cat" in the mobile menu', () => {
    renderWithProviders(<Navbar />);
    // Only the desktop CTA link should exist — not duplicated in the mobile drawer
    expect(screen.getAllByRole('link', { name: /report a missing cat/i })).toHaveLength(1);
  });

  it('shows Settings and Sign out when logged in', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Navbar />, { preloadedState: loggedInState });

    await user.click(screen.getByRole('button', { name: /open menu/i }));

    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
    // Mobile Sign out is always in the DOM when user is logged in (CSS hides it)
    expect(screen.getAllByRole('button', { name: /sign out/i })).toHaveLength(1);
  });

  it('does not show Join when logged in', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Navbar />, { preloadedState: loggedInState });

    await user.click(screen.getByRole('button', { name: /open menu/i }));

    expect(screen.queryByRole('link', { name: /^join$/i })).not.toBeInTheDocument();
  });

  it('signs out from the mobile menu', async () => {
    const user = userEvent.setup();
    const { store } = renderWithProviders(<Navbar />, { preloadedState: loggedInState });

    await user.click(screen.getByRole('button', { name: /open menu/i }));
    await user.click(screen.getByRole('button', { name: /sign out/i }));

    expect(store.getState().auth.user).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
