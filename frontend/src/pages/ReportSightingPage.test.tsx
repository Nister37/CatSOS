import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../test/renderWithProviders';
import { ReportSightingPage } from './ReportSightingPage';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/report-sighting', search: '', hash: '', key: 'default' }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  global.URL.createObjectURL = jest.fn(() => 'blob:mock-preview-url');
  global.URL.revokeObjectURL = jest.fn();
});

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('ReportSightingPage — rendering', () => {
  it('renders the page heading', () => {
    renderWithProviders(<ReportSightingPage />);
    expect(screen.getByRole('heading', { name: /report a sighting/i })).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    renderWithProviders(<ReportSightingPage />);
    expect(screen.getByText(/help us bring a cat home/i)).toBeInTheDocument();
  });

  it('renders all 4 cat cards', () => {
    renderWithProviders(<ReportSightingPage />);
    expect(screen.getByRole('button', { name: /oliver/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /luna/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mochi/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unknown cat/i })).toBeInTheDocument();
  });

  it('renders the "Identify the Cat" section heading', () => {
    renderWithProviders(<ReportSightingPage />);
    expect(screen.getByRole('heading', { name: /identify the cat/i })).toBeInTheDocument();
  });

  it('renders the Additional Details textarea', () => {
    renderWithProviders(<ReportSightingPage />);
    expect(screen.getByPlaceholderText(/where did you see them/i)).toBeInTheDocument();
  });

  it('renders the Sighting Photo upload area', () => {
    renderWithProviders(<ReportSightingPage />);
    expect(screen.getByRole('button', { name: /upload a photo/i })).toBeInTheDocument();
  });

  it('renders the Submit Sighting button', () => {
    renderWithProviders(<ReportSightingPage />);
    expect(screen.getByRole('button', { name: /submit sighting/i })).toBeInTheDocument();
  });

  it('renders the Safety First guidance card', () => {
    renderWithProviders(<ReportSightingPage />);
    expect(screen.getByText(/safety first/i)).toBeInTheDocument();
    expect(screen.getByText(/do not attempt to chase/i)).toBeInTheDocument();
  });

  it('all cat cards start with aria-pressed="false"', () => {
    renderWithProviders(<ReportSightingPage />);
    const cards = [
      screen.getByRole('button', { name: /oliver/i }),
      screen.getByRole('button', { name: /luna/i }),
      screen.getByRole('button', { name: /mochi/i }),
      screen.getByRole('button', { name: /unknown cat/i }),
    ];
    cards.forEach((card) => expect(card).toHaveAttribute('aria-pressed', 'false'));
  });
});

// ─── Cat selection ────────────────────────────────────────────────────────────

describe('ReportSightingPage — cat selection', () => {
  it('sets aria-pressed to true on the clicked card', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportSightingPage />);

    await user.click(screen.getByRole('button', { name: /oliver/i }));

    expect(screen.getByRole('button', { name: /oliver/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('deselects the previous card when a new one is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportSightingPage />);

    await user.click(screen.getByRole('button', { name: /oliver/i }));
    await user.click(screen.getByRole('button', { name: /luna/i }));

    expect(screen.getByRole('button', { name: /oliver/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: /luna/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('only one card can be selected at a time', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportSightingPage />);

    await user.click(screen.getByRole('button', { name: /mochi/i }));

    const allCards = screen.getAllByRole('button', {
      name: /oliver|luna|mochi|unknown cat/i,
    });
    const selected = allCards.filter((c) => c.getAttribute('aria-pressed') === 'true');
    expect(selected).toHaveLength(1);
  });

  it('the Unknown Cat card can also be selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportSightingPage />);

    await user.click(screen.getByRole('button', { name: /unknown cat/i }));

    expect(screen.getByRole('button', { name: /unknown cat/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

// ─── Photo upload ─────────────────────────────────────────────────────────────

describe('ReportSightingPage — photo upload', () => {
  it('renders the upload area with prompt text by default', () => {
    renderWithProviders(<ReportSightingPage />);
    expect(screen.getByText(/tap to upload photo/i)).toBeInTheDocument();
  });

  it('shows an image preview after a file is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportSightingPage />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'cat.png', { type: 'image/png' });
    await user.upload(input, file);

    const preview = screen.getByRole('img', { name: /preview/i });
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveAttribute('src', 'blob:mock-preview-url');
  });

  it('restores the upload prompt after clicking the remove button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportSightingPage />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['img'], 'cat.png', { type: 'image/png' }));

    await user.click(screen.getByRole('button', { name: /remove photo/i }));

    expect(screen.getByText(/tap to upload photo/i)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /preview/i })).not.toBeInTheDocument();
  });
});

// ─── Form submit ──────────────────────────────────────────────────────────────

describe('ReportSightingPage — submit', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows a loading state while submitting', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<ReportSightingPage />);

    await user.click(screen.getByRole('button', { name: /submit sighting/i }));

    expect(screen.getByText(/sending/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();
  });

  it('shows the success state after the timeout completes', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<ReportSightingPage />);

    await user.click(screen.getByRole('button', { name: /submit sighting/i }));

    act(() => jest.advanceTimersByTime(1500));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /sighting reported/i })).toBeInTheDocument(),
    );
  });

  it('success state includes a "Back to Sightings Map" link to /map', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<ReportSightingPage />);

    await user.click(screen.getByRole('button', { name: /submit sighting/i }));
    act(() => jest.advanceTimersByTime(1500));

    await waitFor(() => screen.getByRole('heading', { name: /sighting reported/i }));

    const link = screen.getByRole('link', { name: /back to sightings map/i });
    expect(link).toHaveAttribute('href', '/map');
  });

  it('"Report Another Sighting" resets back to the form', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<ReportSightingPage />);

    await user.click(screen.getByRole('button', { name: /submit sighting/i }));
    act(() => jest.advanceTimersByTime(1500));

    await waitFor(() => screen.getByRole('heading', { name: /sighting reported/i }));

    await user.click(screen.getByRole('button', { name: /report another sighting/i }));

    expect(screen.getByRole('heading', { name: /report a sighting/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /sighting reported/i }),
    ).not.toBeInTheDocument();
  });
});
