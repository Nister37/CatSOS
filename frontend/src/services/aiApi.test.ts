import {
  improveDescription,
  generatePublicSummary,
  getPosterTextSuggestion,
  getTranslationSuggestion,
} from './aiApi';

const mockApiRequest = jest.fn();

jest.mock('../api/client', () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
}));

describe('aiApi service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('improveDescription calls /api/ai/improve-description/ with description', async () => {
    mockApiRequest.mockResolvedValueOnce({
      suggestion: 'Cleaned up description',
      generated_by_ai: true,
      requires_review: true,
      fallback_reason: '',
      privacy_notice: 'Privacy notice',
    });

    const res = await improveDescription('rough description');
    expect(mockApiRequest).toHaveBeenCalledWith('/api/ai/improve-description/', {
      method: 'POST',
      body: JSON.stringify({ description: 'rough description' }),
    });
    expect(res.suggestion).toBe('Cleaned up description');
  });

  it('generatePublicSummary calls /api/ai/public-summary/ with payload', async () => {
    mockApiRequest.mockResolvedValueOnce({
      suggestion: 'Public summary',
      generated_by_ai: true,
      requires_review: true,
      fallback_reason: '',
      privacy_notice: 'Privacy notice',
    });

    const payload = {
      cat_name: 'Luna',
      coat_color: 'Black',
      personality: 'Friendly',
      last_seen_landmark: 'Park',
      description: 'Indoor cat',
    };

    const res = await generatePublicSummary(payload);
    expect(mockApiRequest).toHaveBeenCalledWith('/api/ai/public-summary/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    expect(res.suggestion).toBe('Public summary');
  });

  it('getPosterTextSuggestion calls /api/reports/{id}/poster-text-suggestion/', async () => {
    mockApiRequest.mockResolvedValueOnce({
      suggestion: 'Poster wording',
      generated_by_ai: true,
      requires_review: true,
      fallback_reason: '',
      privacy_notice: 'Privacy notice',
    });

    const res = await getPosterTextSuggestion('rep-123');
    expect(mockApiRequest).toHaveBeenCalledWith('/api/reports/rep-123/poster-text-suggestion/', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(res.suggestion).toBe('Poster wording');
  });

  it('getTranslationSuggestion calls /api/reports/{id}/translation-suggestion/ with target language', async () => {
    mockApiRequest.mockResolvedValueOnce({
      suggestion: 'Translated text',
      target_language: 'pl',
      target_language_label: 'Polish',
      generated_by_ai: true,
      requires_review: true,
      fallback_reason: '',
      privacy_notice: 'Privacy notice',
    });

    const res = await getTranslationSuggestion('rep-123', 'pl');
    expect(mockApiRequest).toHaveBeenCalledWith('/api/reports/rep-123/translation-suggestion/', {
      method: 'POST',
      body: JSON.stringify({ target_language: 'pl' }),
    });
    expect(res.suggestion).toBe('Translated text');
    expect(res.target_language).toBe('pl');
  });
});
