import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../test/renderWithProviders';
import { MissingCatsPage } from './MissingCatsPage';

const CAT_WHISKERS = {
  public_id: 'abc-1',
  cat_name: 'Whiskers',
  breed: 'Tabby',
  coat_color: 'Orange',
  description: '',
  location_summary: 'Central Park',
  last_seen_landmark: 'Near the fountain',
  disappeared_at: '2024-06-01T10:00:00Z',
  approximate_location: { latitude: 51.505, longitude: -0.09, is_approximate: true },
  reward_amount: null,
  status: 'MISSING',
  found_message: '',
  resolved_at: null,
  is_active_search: true,
  main_photo: null,
  updated_at: '2024-06-01T12:00:00Z',
};

const REPORT_DETAIL = {
  public_id: 'abc-1',
  cat_name: 'Whiskers',
  age_years: null,
  breed: 'Tabby',
  coat_color: 'Orange',
  eye_color: '',
  gender: 'UNKNOWN',
  collar_description: '',
  has_microchip: false,
  personality: '',
  description: '',
  disappeared_at: '2024-06-01T10:00:00Z',
  last_seen_landmark: 'Near the fountain',
  approximate_location: null,
  reward_amount: null,
  reward_note: '',
  status: 'MISSING',
  found_message: '',
  is_active_search: true,
  contact: { visibility: 'HIDDEN', instructions: 'Log in to contact the owner.' },
  main_photo: null,
};

jest.mock('../services/reportsApi', () => ({
  fetchPublicReports: jest.fn().mockResolvedValue([CAT_WHISKERS]),
  fetchMissingCatsPage: jest.fn().mockResolvedValue({
    results: [CAT_WHISKERS],
    count: 1,
    hasNext: false,
  }),
  fetchReportDetail: jest.fn().mockResolvedValue(REPORT_DETAIL),
}));

beforeEach(() => jest.clearAllMocks());

describe('MissingCatsPage', () => {
  it('renders cat cards after data loads', async () => {
    renderWithProviders(<MissingCatsPage />);

    expect(await screen.findByRole('heading', { name: /missing cats/i })).toBeInTheDocument();
    expect(await screen.findAllByText('Whiskers')).not.toHaveLength(0);
    expect(screen.getByText('1 active report')).toBeInTheDocument();
  });

  it('opens the detail modal when a card is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MissingCatsPage />);

    const cardButton = await screen.findByRole('button', { name: /whiskers/i });
    await user.click(cardButton);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('Whiskers').length).toBeGreaterThan(0);
  });

  it('shows an empty state when no reports are returned', async () => {
    const { fetchMissingCatsPage, fetchPublicReports } = jest.requireMock('../services/reportsApi');
    fetchMissingCatsPage.mockResolvedValueOnce({ results: [], count: 0, hasNext: false });
    fetchPublicReports.mockResolvedValueOnce([]);

    renderWithProviders(<MissingCatsPage />);

    expect(await screen.findByRole('heading', { name: /no active reports/i })).toBeInTheDocument();
  });

  it('shows Load More and fetches the next page when clicked', async () => {
    const user = userEvent.setup();
    const CAT_SHADOW = { ...CAT_WHISKERS, public_id: 'abc-2', cat_name: 'Shadow' };
    const { fetchMissingCatsPage } = jest.requireMock('../services/reportsApi');
    fetchMissingCatsPage
      .mockResolvedValueOnce({ results: [CAT_WHISKERS], count: 2, hasNext: true })
      .mockResolvedValueOnce({ results: [CAT_SHADOW], count: 2, hasNext: false });

    renderWithProviders(<MissingCatsPage />);

    const loadMore = await screen.findByRole('button', { name: /load more/i });
    await user.click(loadMore);

    await waitFor(() => expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument());
    expect(screen.getByText('Shadow')).toBeInTheDocument();
    expect(fetchMissingCatsPage).toHaveBeenCalledTimes(2);
  });
});
