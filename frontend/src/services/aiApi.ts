import { apiRequest } from '../api/client';

export interface AISuggestionResponse {
  suggestion: string;
  generated_by_ai: boolean;
  requires_review: boolean;
  fallback_reason: string;
  privacy_notice: string;
  target_language?: string;
  target_language_label?: string;
}

export interface PublicSummaryPayload {
  cat_name?: string;
  coat_color?: string;
  personality?: string;
  last_seen_landmark?: string;
  description?: string;
}

export async function improveDescription(description: string): Promise<AISuggestionResponse> {
  return apiRequest<AISuggestionResponse>('/api/ai/improve-description/', {
    method: 'POST',
    body: JSON.stringify({ description }),
  });
}

export async function generatePublicSummary(
  payload: PublicSummaryPayload,
): Promise<AISuggestionResponse> {
  return apiRequest<AISuggestionResponse>('/api/ai/public-summary/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getPosterTextSuggestion(
  reportId: string | number,
): Promise<AISuggestionResponse> {
  return apiRequest<AISuggestionResponse>(`/api/reports/${reportId}/poster-text-suggestion/`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function getTranslationSuggestion(
  reportId: string | number,
  targetLanguage: string,
): Promise<AISuggestionResponse> {
  return apiRequest<AISuggestionResponse>(`/api/reports/${reportId}/translation-suggestion/`, {
    method: 'POST',
    body: JSON.stringify({ target_language: targetLanguage }),
  });
}
