import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../test/renderWithProviders';
import { CatDetailModal } from './CatDetailModal';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const BASE_REPORT = {
  public_id: 'test-123',
  cat_name: 'Mittens',
  age_years: null,
  breed: 'Tabby',
  coat_color: 'Orange',
  eye_color: '',
  gender: 'FEMALE',
  collar_description: '',
  has_microchip: false,
  personality: '',
  description: 'Friendly orange cat.',
  disappeared_at: '2024-06-01T10:00:00Z',
  last_seen_landmark: 'Near the park',
  approximate_location: null,
  reward_amount: null,
  reward_note: '',
  status: 'MISSING',
  found_message: '',
  is_active_search: true,
  contact: { visibility: 'PUBLIC', name: 'Jane', phone: '555-1234', email: 'jane@example.com', instructions: '' },
  main_photo: null,
};

jest.mock('../services/reportsApi', () => ({
  fetchReportDetail: jest.fn().mockResolvedValue(BASE_REPORT),
}));

beforeEach(() => jest.clearAllMocks());

describe('CatDetailModal', () => {
  it('shows a loading skeleton initially then the cat name', async () => {
    const onClose = jest.fn();
    renderWithProviders(<CatDetailModal publicId="test-123" onClose={onClose} />);

    expect(screen.queryByText('Mittens')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Mittens' })).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    renderWithProviders(<CatDetailModal publicId="test-123" onClose={onClose} />);

    await screen.findByRole('heading', { name: 'Mittens' });
    await user.click(screen.getByRole('button', { name: /close/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const { container } = renderWithProviders(
      <CatDetailModal publicId="test-123" onClose={onClose} />,
    );

    await screen.findByRole('heading', { name: 'Mittens' });
    const backdrop = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    await user.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows contact details when visibility is PUBLIC', async () => {
    renderWithProviders(<CatDetailModal publicId="test-123" onClose={jest.fn()} />);

    expect(await screen.findByText('Jane')).toBeInTheDocument();
    expect(screen.getByText('555-1234')).toBeInTheDocument();
  });

  it('shows the "I Spotted This Cat" button for logged-in users on active reports', async () => {
    renderWithProviders(
      <CatDetailModal publicId="test-123" onClose={jest.fn()} />,
      { preloadedState: { auth: { accessToken: 'tok', refreshToken: 'rtok', user: null } } },
    );

    expect(await screen.findByRole('button', { name: /i spotted this cat/i })).toBeInTheDocument();
  });

  it('hides the "I Spotted This Cat" button when logged out', async () => {
    renderWithProviders(<CatDetailModal publicId="test-123" onClose={jest.fn()} />);

    await screen.findByRole('heading', { name: 'Mittens' });
    expect(screen.queryByRole('button', { name: /i spotted this cat/i })).not.toBeInTheDocument();
  });

  it('shows an error state when the API call fails', async () => {
    const { fetchReportDetail } = jest.requireMock('../services/reportsApi');
    fetchReportDetail.mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders(<CatDetailModal publicId="test-123" onClose={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByText(/could not load report details/i)).toBeInTheDocument(),
    );
  });
});
