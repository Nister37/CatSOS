import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../test/renderWithProviders';
import { GeneratePosterPage } from './GeneratePosterPage';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDownloadReportPoster = jest.fn().mockResolvedValue(undefined);
const mockGenerateQRCode = jest.fn().mockResolvedValue({
  public_url: 'https://catsos.app/reports/pub-1',
  qr_code: 'data:image/png;base64,abc123',
  content_type: 'image/png',
});
const mockFetchOwnedReports = jest.fn();

jest.mock('../services/reportsApi', () => ({
  fetchOwnedReports: (...args: unknown[]) => mockFetchOwnedReports(...args),
  generateQRCode: (...args: unknown[]) => mockGenerateQRCode(...args),
  downloadReportPoster: (...args: unknown[]) => mockDownloadReportPoster(...args),
}));

const MOCK_REPORT = {
  id: 'report-uuid-1',
  public_id: 'pub-1',
  cat_name: 'Whiskers',
  status: 'MISSING',
  last_seen_address: 'Main Street, Antwerp',
  last_seen_landmark: 'Near the park',
  last_seen_lat: 51.22,
  last_seen_lng: 4.40,
  disappeared_at: '2026-06-01T00:00:00Z',
  description: 'Orange tabby with white paws',
  breed: 'Tabby',
  coat_color: 'Orange',
  eye_color: 'Green',
  gender: 'M',
  age_years: 3,
  collar_description: '',
  has_microchip: false,
  chip_number: '',
  personality: '',
  reward_amount: null,
  reward_note: '',
  contact_name: 'Jane',
  contact_phone: '+32 123 456 789',
  contact_email: 'owner@test.com',
  contact_visibility: 'PUBLIC',
  found_message: '',
  resolved_at: null,
  is_active_search: true,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
};

const MOCK_REPORT_2 = {
  ...MOCK_REPORT,
  id: 'report-uuid-2',
  public_id: 'pub-2',
  cat_name: 'Luna',
  status: 'RECENTLY_SEEN',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchOwnedReports.mockResolvedValue([MOCK_REPORT, MOCK_REPORT_2]);
  mockGenerateQRCode.mockResolvedValue({
    public_url: 'https://catsos.app/reports/pub-1',
    qr_code: 'data:image/png;base64,abc123',
    content_type: 'image/png',
  });
});

async function renderPage() {
  renderWithProviders(<GeneratePosterPage />);
  await act(async () => {});
}

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('GeneratePosterPage — rendering', () => {
  it('renders the page heading', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { name: /generate poster/i })).toBeInTheDocument();
  });

  it('renders cat cards after loading', async () => {
    await renderPage();
    expect(screen.getByRole('button', { name: /whiskers/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /luna/i })).toBeInTheDocument();
  });

  it('shows empty state when user has no reports', async () => {
    mockFetchOwnedReports.mockResolvedValue([]);
    await renderPage();
    expect(screen.getByText(/no reports yet/i)).toBeInTheDocument();
  });

  it('shows guidance text prompting the user to create a report', async () => {
    mockFetchOwnedReports.mockResolvedValue([]);
    await renderPage();
    expect(screen.getByText(/you need to report a missing cat/i)).toBeInTheDocument();
  });

  it('shows the placeholder when no cat is selected', async () => {
    await renderPage();
    expect(screen.getByText(/select a cat on the left/i)).toBeInTheDocument();
  });
});

// ─── Cat selection ────────────────────────────────────────────────────────────

describe('GeneratePosterPage — cat selection', () => {
  it('auto-selects when there is only one report', async () => {
    mockFetchOwnedReports.mockResolvedValue([MOCK_REPORT]);
    await renderPage();
    expect(screen.getByRole('button', { name: /whiskers/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('sets aria-pressed on the clicked cat card', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole('button', { name: /whiskers/i }));
    expect(screen.getByRole('button', { name: /whiskers/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /luna/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches selection when another cat is clicked', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole('button', { name: /whiskers/i }));
    await user.click(screen.getByRole('button', { name: /luna/i }));
    expect(screen.getByRole('button', { name: /whiskers/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /luna/i })).toHaveAttribute('aria-pressed', 'true');
  });
});

// ─── Preview panel ────────────────────────────────────────────────────────────

describe('GeneratePosterPage — preview panel', () => {
  it('fetches QR code when a cat is selected', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole('button', { name: /whiskers/i }));
    await waitFor(() => expect(mockGenerateQRCode).toHaveBeenCalledWith('report-uuid-1'));
  });

  it('shows the cat name in the poster preview', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole('button', { name: /whiskers/i }));
    // cat name appears in both the card and the poster preview heading
    expect(screen.getAllByText('Whiskers').length).toBeGreaterThanOrEqual(2);
  });

  it('shows the QR code image after it loads', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole('button', { name: /whiskers/i }));
    await waitFor(() =>
      expect(screen.getByRole('img', { name: /qr code/i })).toHaveAttribute('src', 'data:image/png;base64,abc123'),
    );
  });

  it('shows the public URL link strip', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole('button', { name: /whiskers/i }));
    await waitFor(() =>
      expect(screen.getByText('https://catsos.app/reports/pub-1')).toBeInTheDocument(),
    );
  });

  it('re-fetches QR code when the selected cat changes', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole('button', { name: /whiskers/i }));
    await waitFor(() => expect(mockGenerateQRCode).toHaveBeenCalledWith('report-uuid-1'));
    await user.click(screen.getByRole('button', { name: /luna/i }));
    await waitFor(() => expect(mockGenerateQRCode).toHaveBeenCalledWith('report-uuid-2'));
  });
});

// ─── Actions ──────────────────────────────────────────────────────────────────

describe('GeneratePosterPage — actions', () => {
  it('calls downloadReportPoster with the correct report id', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole('button', { name: /whiskers/i }));
    await user.click(screen.getByRole('button', { name: /download poster/i }));
    await waitFor(() =>
      expect(mockDownloadReportPoster).toHaveBeenCalledWith('report-uuid-1', expect.stringContaining('.pdf')),
    );
  });

  it('copy link button is present and clickable after QR code loads', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole('button', { name: /whiskers/i }));
    const copyBtn = await screen.findByRole('button', { name: /copy link/i });
    await user.click(copyBtn); // should not throw
  });
});
