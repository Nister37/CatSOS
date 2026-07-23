import { apiRequest } from '../api/client';

export type BackendNotification = {
  id: string;
  event_type:
    | 'REPORT_CREATED'
    | 'REPORT_STATUS_CHANGED'
    | 'SIGHTING_CREATED'
    | 'SIGHTING_MARKED_USEFUL'
    | 'SIGHTING_MARKED_FALSE';
  title: string;
  message: string;
  action_url: string;
  report: {
    id: string;
    public_id: string;
    cat_name: string;
  } | null;
  sighting?: {
    id: string;
    seen_at: string;
    location_description: string;
    confidence: 'LOW' | 'MEDIUM' | 'HIGH';
    verification_status: 'PENDING' | 'USEFUL' | 'FALSE';
  } | null;
  actor?: {
    display_name: string;
    avatar_fallback: string;
  } | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export async function fetchNotifications(unreadOnly = false): Promise<BackendNotification[]> {
  const qs = unreadOnly ? '?unread=true&page_size=50' : '?page_size=50';
  const data = await apiRequest<PaginatedResponse<BackendNotification>>(`/api/notifications/${qs}`);
  return data.results;
}

export async function fetchNotificationsPage(
  page = 1,
  pageSize = 8,
  unreadOnly = false,
): Promise<{ results: BackendNotification[]; count: number; hasNext: boolean }> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (unreadOnly) params.set('unread', 'true');

  const data = await apiRequest<PaginatedResponse<BackendNotification>>(
    `/api/notifications/?${params.toString()}`,
  );
  return { results: data.results, count: data.count, hasNext: data.next !== null };
}

export async function fetchUnreadCount(): Promise<number> {
  const data = await apiRequest<PaginatedResponse<BackendNotification>>('/api/notifications/?unread=true&page_size=1');
  return data.count;
}

export function markNotificationRead(id: string): Promise<BackendNotification> {
  return apiRequest<BackendNotification>(`/api/notifications/${id}/read/`, { method: 'PATCH' });
}
