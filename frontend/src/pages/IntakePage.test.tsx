import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../test/renderWithProviders';
import { IntakePage } from './IntakePage';
import {
  fetchFoundCatDecisionTree,
  submitIntakeReport,
  type FoundCatDecisionTree,
} from '../services/assistantApi';

jest.mock('../services/assistantApi', () => ({
  fetchFoundCatDecisionTree: jest.fn(),
  submitIntakeReport: jest.fn(),
}));

const mockFetchTree = fetchFoundCatDecisionTree as jest.Mock;
const mockSubmitIntake = submitIntakeReport as jest.Mock;

const sampleDecisionTree: FoundCatDecisionTree = {
  id: 'found-cat',
  version: '2026-07-23',
  entry_node_id: 'injury',
  safety_notice: 'This assistant gives general safety steps only.',
  nodes: [
    {
      id: 'injury',
      type: 'question',
      prompt: 'Does the cat appear injured, trapped, or in immediate danger?',
      guidance: ['Assess safely from distance'],
      answers: [
        {
          id: 'yes',
          label: 'Yes, injured or in danger',
          next_node_id: 'urgent_help',
          guidance: ['Do not handle abruptly'],
        },
        {
          id: 'no',
          label: 'No, appears healthy',
          next_node_id: 'check_collar',
        },
      ],
    },
    {
      id: 'check_collar',
      type: 'question',
      prompt: 'Does the cat have a collar or tag?',
      answers: [
        {
          id: 'has_collar',
          label: 'Yes, has collar',
          next_node_id: 'collar_outcome',
        },
      ],
    },
    {
      id: 'urgent_help',
      type: 'outcome',
      title: 'Prioritize urgent veterinary care',
      severity: 'emergency',
      guidance: [
        'Keep the cat warm with a blanket.',
        'Do not give human medication.',
        'Contact emergency vet clinic immediately.',
      ],
      links: [{ label: 'Find nearby help', endpoint: '/api/maps/nearby-help/' }],
    },
    {
      id: 'collar_outcome',
      type: 'outcome',
      title: 'Check the contact tag',
      severity: 'normal',
      guidance: ['Call the phone number listed on the tag.'],
    },
  ],
};

describe('IntakePage — Direct Intake Form', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders direct intake form by default', () => {
    renderWithProviders(<IntakePage />);

    expect(screen.getByLabelText(/cat name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/reporter email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/urgency/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/situation/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit report/i })).toBeInTheDocument();
  });

  it('validates required fields on submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<IntakePage />);

    await user.click(screen.getByRole('button', { name: /submit report/i }));

    await waitFor(() => {
      expect(screen.getByText(/enter at least 2 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/enter a valid email address/i)).toBeInTheDocument();
      expect(screen.getByText(/enter at least 10 characters/i)).toBeInTheDocument();
    });
    expect(mockSubmitIntake).not.toHaveBeenCalled();
  });

  it('submits report successfully when form is valid', async () => {
    const user = userEvent.setup();
    mockSubmitIntake.mockResolvedValueOnce({
      id: 1,
      catName: 'Whiskers',
      reporterEmail: 'helper@example.com',
      urgency: 'medium',
      description: 'Found near the community center hiding in bushes.',
      status: 'QUEUED',
      created_at: '2026-10-27T22:00:00Z',
    });

    const { store } = renderWithProviders(<IntakePage />);

    await user.type(screen.getByLabelText(/cat name/i), 'Whiskers');
    await user.type(screen.getByLabelText(/reporter email/i), 'helper@example.com');
    await user.type(
      screen.getByLabelText(/situation/i),
      'Found near the community center hiding in bushes.',
    );
    await user.click(screen.getByRole('button', { name: /submit report/i }));

    await waitFor(() => {
      expect(mockSubmitIntake).toHaveBeenCalledWith({
        catName: 'Whiskers',
        reporterEmail: 'helper@example.com',
        urgency: 'medium',
        description: 'Found near the community center hiding in bushes.',
      });
    });

    const notifications = store.getState().notifications.items;
    expect(notifications.some((n) => n.message.includes('Report queued for review'))).toBe(true);
  });

  it('handles submission error gracefully', async () => {
    const user = userEvent.setup();
    mockSubmitIntake.mockRejectedValueOnce(new Error('Network error'));

    const { store } = renderWithProviders(<IntakePage />);

    await user.type(screen.getByLabelText(/cat name/i), 'Whiskers');
    await user.type(screen.getByLabelText(/reporter email/i), 'helper@example.com');
    await user.type(
      screen.getByLabelText(/situation/i),
      'Found near the community center hiding in bushes.',
    );
    await user.click(screen.getByRole('button', { name: /submit report/i }));

    await waitFor(() => {
      expect(mockSubmitIntake).toHaveBeenCalled();
    });

    const notifications = store.getState().notifications.items;
    expect(
      notifications.some((n) => n.message.includes('Failed to submit intake report')),
    ).toBe(true);
  });
});

describe('IntakePage — Decision Assistant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads and navigates dynamic decision tree steps', async () => {
    const user = userEvent.setup();
    mockFetchTree.mockResolvedValueOnce(sampleDecisionTree);

    renderWithProviders(<IntakePage />);

    // Switch to Decision Assistant tab
    await user.click(screen.getByRole('button', { name: /decision assistant/i }));

    // Expect safety notice and first question
    await waitFor(() => {
      expect(
        screen.getByText(/this assistant gives general safety steps only/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/does the cat appear injured, trapped, or in immediate danger/i),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/yes, injured or in danger/i)).toBeInTheDocument();
    expect(screen.getByText(/no, appears healthy/i)).toBeInTheDocument();

    // Click 'Yes, injured or in danger' -> leads to 'urgent_help' outcome
    await user.click(screen.getByText(/yes, injured or in danger/i));

    // Verify outcome display
    await waitFor(() => {
      expect(
        screen.getByText(/prioritize urgent veterinary care/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/emergency step/i)).toBeInTheDocument();
      expect(screen.getByText(/keep the cat warm with a blanket/i)).toBeInTheDocument();
    });

    // Test Back button
    const backBtn = screen.getByRole('button', { name: /back/i });
    expect(backBtn).toBeInTheDocument();
    await user.click(backBtn);

    // Should return to the first question
    await waitFor(() => {
      expect(
        screen.getByText(/does the cat appear injured, trapped, or in immediate danger/i),
      ).toBeInTheDocument();
    });

    // Advance to next branch: 'No, appears healthy' -> 'check_collar'
    await user.click(screen.getByText(/no, appears healthy/i));
    await waitFor(() => {
      expect(screen.getByText(/does the cat have a collar or tag/i)).toBeInTheDocument();
    });

    // Test Start Over button
    await user.click(screen.getByRole('button', { name: /start over/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/does the cat appear injured, trapped, or in immediate danger/i),
      ).toBeInTheDocument();
    });
  });

  it('displays error and retry button when tree fetch fails', async () => {
    const user = userEvent.setup();
    mockFetchTree.mockRejectedValueOnce(new Error('Fetch failed'));

    renderWithProviders(<IntakePage />);

    await user.click(screen.getByRole('button', { name: /decision assistant/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/failed to load decision assistant/i),
      ).toBeInTheDocument();
    });

    // Test retry
    mockFetchTree.mockResolvedValueOnce(sampleDecisionTree);
    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/does the cat appear injured, trapped, or in immediate danger/i),
      ).toBeInTheDocument();
    });
  });

  it('allows user to proceed to direct intake form from outcome card', async () => {
    const user = userEvent.setup();
    mockFetchTree.mockResolvedValueOnce(sampleDecisionTree);

    renderWithProviders(<IntakePage />);

    await user.click(screen.getByRole('button', { name: /decision assistant/i }));

    await waitFor(() => {
      expect(screen.getByText(/yes, injured or in danger/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/yes, injured or in danger/i));

    await waitFor(() => {
      expect(screen.getByText(/prioritize urgent veterinary care/i)).toBeInTheDocument();
    });

    const proceedBtn = screen.getByRole('button', { name: /fill intake form/i });
    expect(proceedBtn).toBeInTheDocument();
    await user.click(proceedBtn);

    expect(screen.getByLabelText(/cat name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/reporter email/i)).toBeInTheDocument();
  });

  it('gracefully handles missing next node by falling back to entry node', async () => {
    const user = userEvent.setup();
    const treeWithBrokenLink: FoundCatDecisionTree = {
      ...sampleDecisionTree,
      nodes: [
        {
          id: 'injury',
          type: 'question',
          prompt: 'Does the cat appear injured?',
          answers: [
            {
              id: 'broken',
              label: 'Go to missing node',
              next_node_id: 'non_existent_node_id',
            },
          ],
        },
      ],
    };

    mockFetchTree.mockResolvedValueOnce(treeWithBrokenLink);

    renderWithProviders(<IntakePage />);

    await user.click(screen.getByRole('button', { name: /decision assistant/i }));

    await waitFor(() => {
      expect(screen.getByText(/go to missing node/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/go to missing node/i));

    // Should fall back to entry node and remain functional
    await waitFor(() => {
      expect(screen.getByText(/does the cat appear injured/i)).toBeInTheDocument();
    });
  });
});
