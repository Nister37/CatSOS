import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../test/renderWithProviders';
import { ReportStep2Page } from './ReportStep2Page';

const mockNavigate = jest.fn();
const mockStep1State = {
  step1: { catName: 'Luna', breedColor: 'Tuxedo', hasMicrochip: 'no' as const },
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({
    state: mockStep1State,
    pathname: '/report-missing/location',
    search: '',
    hash: '',
    key: 'default',
  }),
}));

// Suppress geolocation calls in jsdom
beforeAll(() => {
  Object.defineProperty(global.navigator, 'geolocation', {
    value: { getCurrentPosition: jest.fn() },
    configurable: true,
  });
});

beforeEach(() => jest.clearAllMocks());

describe('ReportStep2Page — rendering', () => {
  it('renders the page heading', () => {
    renderWithProviders(<ReportStep2Page />);
    expect(
      screen.getByRole('heading', { name: /where was your cat last seen/i }),
    ).toBeInTheDocument();
  });

  it('renders the step 2 of 3 progress label', () => {
    renderWithProviders(<ReportStep2Page />);
    expect(screen.getByText(/step 2 of 3/i)).toBeInTheDocument();
    expect(screen.getByText(/66% complete/i)).toBeInTheDocument();
  });

  it('renders the custom map zoom controls', () => {
    renderWithProviders(<ReportStep2Page />);
    expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /zoom out/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /centre on my location/i })).toBeInTheDocument();
  });

  it('renders the street address and landmark inputs', () => {
    renderWithProviders(<ReportStep2Page />);
    expect(screen.getByLabelText(/street address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/area \/ landmark/i)).toBeInTheDocument();
  });

  it('renders the three contextual bento cards', () => {
    renderWithProviders(<ReportStep2Page />);
    expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
    expect(screen.getByText(/local network/i)).toBeInTheDocument();
    expect(screen.getByText(/privacy first/i)).toBeInTheDocument();
  });

  it('renders the back link pointing to /report-missing', () => {
    renderWithProviders(<ReportStep2Page />);
    const backLink = screen.getByRole('link', { name: /back to cat details/i });
    expect(backLink).toHaveAttribute('href', '/report-missing');
  });
});

describe('ReportStep2Page — validation', () => {
  it('shows an error when submitting with an empty address', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportStep2Page />);

    await user.click(screen.getByRole('button', { name: /next: contact details/i }));

    await waitFor(() =>
      expect(screen.getByText(/please enter a street address/i)).toBeInTheDocument(),
    );
  });

  it('shows an error when the address is shorter than 5 characters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportStep2Page />);

    await user.type(screen.getByLabelText(/street address/i), 'Elm');
    await user.click(screen.getByRole('button', { name: /next: contact details/i }));

    await waitFor(() =>
      expect(screen.getByText(/please enter a street address/i)).toBeInTheDocument(),
    );
  });
});

describe('ReportStep2Page — navigation', () => {
  it('navigates to the contact step with address data on a valid submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportStep2Page />);

    await user.type(screen.getByLabelText(/street address/i), 'Baker Street, London');
    await user.click(screen.getByRole('button', { name: /next: contact details/i }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        '/report-missing/contact',
        expect.objectContaining({
          state: expect.objectContaining({
            step1: mockStep1State.step1,
            step2: expect.objectContaining({ address: 'Baker Street, London' }),
          }),
        }),
      ),
    );
  });

  it('includes the landmark in the navigation state when provided', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportStep2Page />);

    await user.type(screen.getByLabelText(/street address/i), 'Baker Street, London');
    await user.type(screen.getByLabelText(/area \/ landmark/i), 'Near the park');
    await user.click(screen.getByRole('button', { name: /next: contact details/i }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        '/report-missing/contact',
        expect.objectContaining({
          state: expect.objectContaining({
            step2: expect.objectContaining({ landmark: 'Near the park' }),
          }),
        }),
      ),
    );
  });
});
