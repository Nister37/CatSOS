import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../test/renderWithProviders';
import { ReportStep1Page } from './ReportStep1Page';

// Variables prefixed with 'mock' are accessible inside jest.mock() factories
// due to Babel's Jest hoisting transform.
const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null, pathname: '/report-missing', search: '', hash: '', key: 'default' }),
}));

beforeEach(() => jest.clearAllMocks());

describe('ReportStep1Page — rendering', () => {
  it('renders the step heading and progress label', () => {
    renderWithProviders(<ReportStep1Page />);
    expect(screen.getByRole('heading', { name: /basic information/i })).toBeInTheDocument();
    expect(screen.getByText(/step 1 of 3/i)).toBeInTheDocument();
  });

  it('renders the cat name, coat color, breed, and description fields', () => {
    renderWithProviders(<ReportStep1Page />);
    expect(screen.getByLabelText(/cat's name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/coat color/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/breed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it('renders the "No" microchip radio pre-selected', () => {
    renderWithProviders(<ReportStep1Page />);
    expect(screen.getByRole('radio', { name: /no/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /yes/i })).not.toBeChecked();
  });

  it('renders the chip number field as disabled (opacity-50) by default', () => {
    renderWithProviders(<ReportStep1Page />);
    const chipContainer = screen.getByPlaceholderText(/15-digit number/i).closest('div');
    expect(chipContainer).toHaveClass('opacity-50');
  });

  it('renders the pro-tip section', () => {
    renderWithProviders(<ReportStep1Page />);
    expect(screen.getByText(/pro-tip for searchers/i)).toBeInTheDocument();
  });
});

describe('ReportStep1Page — microchip toggle', () => {
  it('enables the chip number field when the Yes radio is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportStep1Page />);

    await user.click(screen.getByRole('radio', { name: /yes/i }));

    const chipContainer = screen.getByPlaceholderText(/15-digit number/i).closest('div');
    expect(chipContainer).not.toHaveClass('opacity-50');
  });

  it('re-disables the chip number field when No is selected after Yes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportStep1Page />);

    await user.click(screen.getByRole('radio', { name: /yes/i }));
    await user.click(screen.getByRole('radio', { name: /no/i }));

    const chipContainer = screen.getByPlaceholderText(/15-digit number/i).closest('div');
    expect(chipContainer).toHaveClass('opacity-50');
  });
});

describe('ReportStep1Page — validation', () => {
  it('shows a validation error for a cat name that is too short', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportStep1Page />);

    await user.type(screen.getByLabelText(/cat's name/i), 'A');
    await user.type(screen.getByLabelText(/coat color/i), 'Black');
    await user.type(screen.getByLabelText(/description/i), 'Friendly tabby cat');
    await user.click(screen.getByRole('button', { name: /next: location details/i }));

    await waitFor(() =>
      expect(screen.getByText(/name must be at least 2 characters/i)).toBeInTheDocument(),
    );
  });

  it('shows a validation error when coat color is empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportStep1Page />);

    await user.type(screen.getByLabelText(/cat's name/i), 'Luna');
    await user.type(screen.getByLabelText(/description/i), 'Friendly tabby cat');
    await user.click(screen.getByRole('button', { name: /next: location details/i }));

    await waitFor(() =>
      expect(screen.getByText(/please describe the coat color/i)).toBeInTheDocument(),
    );
  });

  it('shows a validation error when description is empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportStep1Page />);

    await user.type(screen.getByLabelText(/cat's name/i), 'Luna');
    await user.type(screen.getByLabelText(/coat color/i), 'Black & White');
    await user.click(screen.getByRole('button', { name: /next: location details/i }));

    await waitFor(() =>
      expect(screen.getByText(/please add a short description/i)).toBeInTheDocument(),
    );
  });
});

describe('ReportStep1Page — navigation', () => {
  it('navigates to the location step with the form data on a valid submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportStep1Page />);

    await user.type(screen.getByLabelText(/cat's name/i), 'Luna');
    await user.type(screen.getByLabelText(/coat color/i), 'Black & White');
    await user.type(screen.getByLabelText(/description/i), 'Friendly tabby cat');
    await user.click(screen.getByRole('button', { name: /next: location details/i }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        '/report-missing/location',
        expect.objectContaining({
          state: expect.objectContaining({
            step1: expect.objectContaining({ catName: 'Luna', coatColor: 'Black & White', hasMicrochip: 'no' }),
          }),
        }),
      ),
    );
  });

  it('includes the chip number in navigation state when hasMicrochip is yes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportStep1Page />);

    await user.type(screen.getByLabelText(/cat's name/i), 'Milo');
    await user.type(screen.getByLabelText(/coat color/i), 'Orange');
    await user.type(screen.getByLabelText(/description/i), 'Fluffy orange cat');
    await user.click(screen.getByRole('radio', { name: /yes/i }));
    await user.type(screen.getByPlaceholderText(/15-digit number/i), '123456789012345');
    await user.click(screen.getByRole('button', { name: /next: location details/i }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        '/report-missing/location',
        expect.objectContaining({
          state: expect.objectContaining({
            step1: expect.objectContaining({
              hasMicrochip: 'yes',
              chipNumber: '123456789012345',
            }),
          }),
        }),
      ),
    );
  });
});
