import { apiRequest } from '../api/client';
import { fetchFoundCatDecisionTree, submitIntakeReport } from './assistantApi';

jest.mock('../api/client', () => ({
  apiRequest: jest.fn(),
}));

describe('assistantApi', () => {
  const mockApiRequest = apiRequest as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchFoundCatDecisionTree', () => {
    it('requests the found-cat decision tree endpoint', async () => {
      const mockTree = {
        id: 'found-cat',
        version: '2026-07-23',
        entry_node_id: 'injury',
        safety_notice: 'Safety notice',
        nodes: [],
      };
      mockApiRequest.mockResolvedValueOnce(mockTree);

      const result = await fetchFoundCatDecisionTree();

      expect(mockApiRequest).toHaveBeenCalledWith('/api/assistant/found-cat/decision-tree/');
      expect(result).toEqual(mockTree);
    });
  });

  describe('submitIntakeReport', () => {
    it('posts the intake payload to the intake endpoint', async () => {
      const payload = {
        catName: 'Luna',
        reporterEmail: 'luna@example.com',
        urgency: 'high' as const,
        description: 'Found in the garden injured.',
      };
      const mockResponse = {
        id: 1,
        ...payload,
        status: 'QUEUED',
        created_at: '2026-10-27T22:00:00Z',
      };
      mockApiRequest.mockResolvedValueOnce(mockResponse);

      const result = await submitIntakeReport(payload);

      expect(mockApiRequest).toHaveBeenCalledWith('/api/assistant/intake/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      expect(result).toEqual(mockResponse);
    });
  });
});
