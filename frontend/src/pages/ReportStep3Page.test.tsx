import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../test/renderWithProviders';
import { ReportStep3Page } from './ReportStep3Page';

const mockNavigate = jest.fn();
const mockRouterState = {
  step1: { catName: 'Luna', breedColor: 'Tuxedo', hasMicrochip: 'no' as const },
  step2: { address: 'Baker Street, London' },
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({
    state: mockRouterState,
    pathname: '/report-missing/contact',
    search: '',
    hash: '',
    key: 'default',
  }),
}));

beforeEach(() => jest.clearAllMocks());

describe('ReportStep3Page — rendering', () => {
  it('renders the "Final Step" heading', () => {
    renderWithProviders(<ReportStep3Page />);
    expect(screen.getByRole('heading', { name: /final step/i })).toBeInTheDocument();
  });

  it('renders all contact input fields', () => {
    renderWithProviders(<ReportStep3Page />);
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  });

  it('renders the notification preference checkboxes', () => {
    renderWithProviders(<ReportStep3Page />);
    expect(screen.getByRole('checkbox', { name: /push alerts/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /sms/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /email/i })).toBeInTheDocument();
  });

  it('pre-checks Push Alerts and SMS, leaves Email unchecked', () => {
    renderWithProviders(<ReportStep3Page />);
    expect(screen.getByRole('checkbox', { name: /push alerts/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /sms/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /email/i })).not.toBeChecked();
  });

  it('renders the privacy protection card', () => {
    renderWithProviders(<ReportStep3Page />);
    expect(screen.getByText(/privacy protection/i)).toBeInTheDocument();
  });
});

describe('ReportStep3Page — step tracker', () => {
  it('shows the cat name from step 1 state in the tracker', () => {
    renderWithProviders(<ReportStep3Page />);
    expect(screen.getByText(/cat: luna/i)).toBeInTheDocument();
  });

  it('shows "Location set" when step 2 address exists', () => {
    renderWithProviders(<ReportStep3Page />);
    expect(screen.getByText(/location set/i)).toBeInTheDocument();
  });

  it('shows "Contact Information" as the active (bold) step', () => {
    renderWithProviders(<ReportStep3Page />);
    expect(screen.getByText('Contact Information')).toBeInTheDocument();
  });

  it('renders the back link pointing to /report-missing/location', () => {
    renderWithProviders(<ReportStep3Page />);
    const backLink = screen.getByRole('link', { name: /back to location/i });
    expect(backLink).toHaveAttribute('href', '/report-missing/location');
  });
});

describe('ReportStep3Page — validation', () => {
  it('shows errors for all required fields when submitted empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportStep3Page />);

    await user.click(screen.getByRole('button', { name: /post missing report/i }));

    await waitFor(() => {
      expect(screen.getByText(/please enter your full name/i)).toBeInTheDocument();
      expect(screen.getByText(/please enter a valid phone number/i)).toBeInTheDocument();
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });
  });

  it('shows an email validation error for an invalid email', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportStep3Page />);

    await user.type(screen.getByLabelText(/full name/i), 'Jane Doe');
    await user.type(screen.getByLabelText(/phone number/i), '+44 7700 900123');
    await user.type(screen.getByLabelText(/email address/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /post missing report/i }));

    await waitFor(() =>
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument(),
    );
  });
});

describe('ReportStep3Page — submission', () => {
  const fillAndSubmit = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText(/full name/i), 'Jane Doe');
    await user.type(screen.getByLabelText(/phone number/i), '+44 7700 900123');
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await user.click(screen.getByRole('button', { name: /post missing report/i }));
  };

  // Keep nextTick/setImmediate real so findBy* polling and Promise chains resolve
  // normally while setTimeout is faked (controls the simulated API delay).
  const useFakeTimersSafe = () =>
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });

  it('shows the "Broadcasting Alert…" loading state immediately after submit', async () => {
    useFakeTimersSafe();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime.bind(jest) });
    renderWithProviders(<ReportStep3Page />);

    await fillAndSubmit(user);

    expect(await screen.findByText(/broadcasting alert/i)).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('transitions to the "Alert Posted!" state after the API delay', async () => {
    useFakeTimersSafe();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime.bind(jest) });
    renderWithProviders(<ReportStep3Page />);

    await fillAndSubmit(user);
    await screen.findByText(/broadcasting alert/i); // wait for loading to appear
    await act(async () => { jest.advanceTimersByTime(1500); });

    await waitFor(() =>
      expect(screen.getByText(/alert posted/i)).toBeInTheDocument(),
    );
    jest.useRealTimers();
  });

  it('dispatches a success notification containing the cat name', async () => {
    useFakeTimersSafe();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime.bind(jest) });
    const { store } = renderWithProviders(<ReportStep3Page />);

    await fillAndSubmit(user);
    await screen.findByText(/broadcasting alert/i);
    await act(async () => { jest.advanceTimersByTime(1500); });

    await waitFor(() => {
      const items = store.getState().notifications.items;
      expect(items).toHaveLength(1);
      expect(items[0].tone).toBe('success');
      expect(items[0].message).toMatch(/luna/i);
    });
    jest.useRealTimers();
  });

  it('navigates to the home page after submission completes', async () => {
    useFakeTimersSafe();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime.bind(jest) });
    renderWithProviders(<ReportStep3Page />);

    await fillAndSubmit(user);
    await screen.findByText(/broadcasting alert/i);
    await act(async () => { jest.advanceTimersByTime(1500); });
    await act(async () => { jest.advanceTimersByTime(800); });

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'));
    jest.useRealTimers();
  });
});
