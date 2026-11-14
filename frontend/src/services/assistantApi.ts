import { apiRequest } from '../api/client';

export interface DecisionTreeAnswer {
  id: string;
  label: string;
  next_node_id: string;
  guidance?: string[];
}

export interface DecisionTreeLink {
  label: string;
  endpoint: string;
}

export interface DecisionTreeNode {
  id: string;
  type: 'question' | 'outcome';
  prompt?: string;
  title?: string;
  severity?: 'normal' | 'emergency';
  guidance?: string[];
  answers?: DecisionTreeAnswer[];
  links?: DecisionTreeLink[];
}

export interface FoundCatDecisionTree {
  id: string;
  version: string;
  entry_node_id: string;
  safety_notice: string;
  nodes: DecisionTreeNode[];
}

export interface IntakeReportPayload {
  catName: string;
  reporterEmail: string;
  urgency: 'low' | 'medium' | 'high';
  description: string;
}

export interface IntakeReportResponse {
  id: number;
  catName: string;
  reporterEmail: string;
  urgency: 'low' | 'medium' | 'high';
  description: string;
  status: string;
  created_at: string;
}

export async function fetchFoundCatDecisionTree(): Promise<FoundCatDecisionTree> {
  return apiRequest<FoundCatDecisionTree>('/api/assistant/found-cat/decision-tree/');
}

export async function submitIntakeReport(
  payload: IntakeReportPayload,
): Promise<IntakeReportResponse> {
  return apiRequest<IntakeReportResponse>('/api/assistant/intake/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
