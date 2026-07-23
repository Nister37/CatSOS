import type { ReportStep1Data } from '../schemas/reportStep1Schema';
import type { ReportStep2Data } from '../schemas/reportStep2Schema';
import type { ReportStep3Data } from '../schemas/reportStep3Schema';
import { apiRequest } from '../api/client';
import { store } from '../app/store';

type CreateReportPayload = {
  step1: ReportStep1Data;
  step2: ReportStep2Data;
  step3: ReportStep3Data;
  photo?: File | null;
};

export type PublicReport = {
  public_id: string;
  cat_name: string;
  breed: string;
  coat_color: string;
  description: string;
  location_summary: string;
  last_seen_landmark: string;
  disappeared_at: string | null;
  approximate_location: { latitude: number; longitude: number; is_approximate: boolean } | null;
  reward_amount: string | null;
  status: string;
  found_message: string;
  resolved_at: string | null;
  is_active_search: boolean;
  main_photo: { url: string } | null;
  updated_at: string;
};

export type OwnedReport = {
  id: string;
  public_id: string;
  cat_name: string;
  age_years: number | null;
  breed: string;
  coat_color: string;
  eye_color: string;
  gender: string;
  collar_description: string;
  has_microchip: boolean;
  chip_number: string;
  personality: string;
  description: string;
  disappeared_at: string | null;
  last_seen_address: string;
  last_seen_landmark: string;
  last_seen_lat: number | null;
  last_seen_lng: number | null;
  reward_amount: string | null;
  reward_note: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  contact_visibility: string;
  status: string;
  found_message: string;
  resolved_at: string | null;
  is_active_search: boolean;
  created_at: string;
  updated_at: string;
};

export type OwnedSighting = {
  id: string;
  report_public_id: string;
  seen_at: string;
  location_description: string;
  latitude: number | null;
  longitude: number | null;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  notes: string;
  photos: { id: string; url: string; created_at: string }[];
  verification_status: 'PENDING' | 'USEFUL' | 'FALSE';
  created_at: string;
  submitted_by: { display_name: string; avatar_fallback: string } | null;
  verified_by: { display_name: string; avatar_fallback: string } | null;
  verified_at: string | null;
  updated_at: string;
};

export type TimelineEvent = {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  location_summary: string | null;
  actor: { display_name: string; avatar_fallback: string } | null;
  created_at: string;
};

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export function createSighting(
  publicId: string,
  data: {
    seen_at: string;
    latitude: number;
    longitude: number;
    location_description: string;
    confidence: 'LOW' | 'MEDIUM' | 'HIGH';
    notes: string;
    photo?: File | null;
  },
): Promise<void> {
  if (data.photo) {
    const form = new FormData();
    form.append('seen_at', data.seen_at);
    form.append('latitude', String(data.latitude));
    form.append('longitude', String(data.longitude));
    if (data.location_description) form.append('location_description', data.location_description);
    form.append('confidence', data.confidence);
    if (data.notes) form.append('notes', data.notes);
    form.append('photo', data.photo);
    return apiRequest<void>(`/api/public/reports/${publicId}/sightings/`, {
      method: 'POST',
      body: form,
    });
  }
  return apiRequest<void>(`/api/public/reports/${publicId}/sightings/`, {
    method: 'POST',
    body: JSON.stringify({
      seen_at: data.seen_at,
      latitude: data.latitude,
      longitude: data.longitude,
      location_description: data.location_description,
      confidence: data.confidence,
      notes: data.notes,
    }),
  });
}

export function createReport({ step1, step2, step3, photo }: CreateReportPayload) {
  const fields: Record<string, string | number | boolean | null> = {
    cat_name: step1.catName,
    breed: step1.breed ?? '',
    coat_color: step1.coatColor,
    description: step1.description,
    has_microchip: step1.hasMicrochip === 'yes',
    chip_number: step1.chipNumber ?? '',
    last_seen_address: step2.address,
    last_seen_landmark: step2.landmark ?? '',
    last_seen_lat: step2.lat ?? null,
    last_seen_lng: step2.lng ?? null,
    disappeared_at: step2.disappearedAt ? new Date(step2.disappearedAt).toISOString() : null,
    contact_name: step3.ownerName,
    contact_phone: step3.phone,
    contact_email: step3.email,
    notify_push: step3.notifyPush,
    notify_sms: step3.notifySms,
    notify_email: step3.notifyEmail,
  };

  if (photo) {
    const form = new FormData();
    Object.entries(fields).forEach(([k, v]) => {
      if (v !== null && v !== undefined) form.append(k, String(v));
    });
    form.append('photo', photo);
    return apiRequest<OwnedReport>('/api/reports/', { method: 'POST', body: form });
  }

  return apiRequest<OwnedReport>('/api/reports/', {
    method: 'POST',
    body: JSON.stringify(fields),
  });
}

export async function fetchOwnedReports(): Promise<OwnedReport[]> {
  const data = await apiRequest<PaginatedResponse<OwnedReport>>('/api/reports/?page_size=50');
  return data.results;
}

export async function fetchOwnedReportsPage(
  page = 1,
  pageSize = 6,
): Promise<{ results: OwnedReport[]; count: number; hasNext: boolean }> {
  const data = await apiRequest<PaginatedResponse<OwnedReport>>(
    `/api/reports/?page=${page}&page_size=${pageSize}`,
  );
  return { results: data.results, count: data.count, hasNext: data.next !== null };
}

export function fetchOwnedReport(id: string): Promise<OwnedReport> {
  return apiRequest<OwnedReport>(`/api/reports/${id}/`);
}

export async function fetchReportSightings(id: string): Promise<OwnedSighting[]> {
  const data = await apiRequest<PaginatedResponse<OwnedSighting>>(`/api/reports/${id}/sightings/?page_size=50`);
  return data.results;
}

export async function fetchReportTimeline(id: string): Promise<TimelineEvent[]> {
  const data = await apiRequest<PaginatedResponse<TimelineEvent>>(`/api/reports/${id}/timeline/?page_size=50`);
  return data.results;
}

export async function fetchReportSightingsPage(
  id: string,
  page = 1,
  pageSize = 6,
): Promise<{ results: OwnedSighting[]; count: number; hasNext: boolean }> {
  const data = await apiRequest<PaginatedResponse<OwnedSighting>>(
    `/api/reports/${id}/sightings/?page=${page}&page_size=${pageSize}`,
  );
  return { results: data.results, count: data.count, hasNext: data.next !== null };
}

export async function fetchReportTimelinePage(
  id: string,
  page = 1,
  pageSize = 8,
): Promise<{ results: TimelineEvent[]; count: number; hasNext: boolean }> {
  const data = await apiRequest<PaginatedResponse<TimelineEvent>>(
    `/api/reports/${id}/timeline/?page=${page}&page_size=${pageSize}`,
  );
  return { results: data.results, count: data.count, hasNext: data.next !== null };
}

export function verifySighting(
  reportId: string,
  sightingId: string,
  verificationStatus: 'USEFUL' | 'FALSE',
): Promise<void> {
  return apiRequest<void>(`/api/reports/${reportId}/sightings/${sightingId}/verification/`, {
    method: 'PATCH',
    body: JSON.stringify({ verification_status: verificationStatus }),
  });
}

export type ReportDetail = {
  public_id: string;
  cat_name: string;
  age_years: number | null;
  breed: string;
  coat_color: string;
  eye_color: string;
  gender: string;
  collar_description: string;
  has_microchip: boolean;
  personality: string;
  description: string;
  disappeared_at: string | null;
  last_seen_landmark: string;
  approximate_location: { latitude: number; longitude: number; is_approximate: boolean } | null;
  reward_amount: string | null;
  reward_note: string;
  status: string;
  found_message: string;
  is_active_search: boolean;
  contact: {
    visibility: string;
    name?: string;
    phone?: string;
    email?: string;
    instructions: string;
  };
  main_photo: { url: string } | null;
};

const BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? 'http://localhost:8000';

export async function fetchReportDetail(publicId: string): Promise<ReportDetail> {
  const res = await fetch(`${BASE_URL}/api/public/reports/${publicId}/`);
  if (!res.ok) throw await res.json().catch(() => ({ detail: 'Request failed' }));
  return res.json() as Promise<ReportDetail>;
}

export async function fetchPublicReports(limit = 4): Promise<PublicReport[]> {
  const data = await fetch(`${BASE_URL}/api/public/reports/?page_size=${limit}`);
  if (!data.ok) throw await data.json().catch(() => ({ detail: 'Request failed' }));
  const json = (await data.json()) as { results: PublicReport[] };
  return json.results;
}

export type QRCodePayload = {
  public_url: string;
  qr_code: string;
  content_type: string;
};

export function generateQRCode(reportId: string): Promise<QRCodePayload> {
  return apiRequest<QRCodePayload>(`/api/reports/${reportId}/qr-code/`, { method: 'POST' });
}

export async function downloadReportPoster(reportId: string, filename: string): Promise<void> {
  const token = store.getState().auth.accessToken;
  const BASE = import.meta.env?.VITE_API_BASE_URL ?? 'http://localhost:8000';
  const res = await fetch(`${BASE}/api/reports/${reportId}/poster/`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Failed to generate poster');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function fetchMissingCatsPage(
  page = 1,
  pageSize = 12,
): Promise<{ results: PublicReport[]; count: number; hasNext: boolean }> {
  const res = await fetch(
    `${BASE_URL}/api/public/reports/?page=${page}&page_size=${pageSize}`,
  );
  if (!res.ok) throw await res.json().catch(() => ({ detail: 'Request failed' }));
  const json = (await res.json()) as { results: PublicReport[]; count: number; next: string | null };
  return { results: json.results, count: json.count, hasNext: json.next !== null };
}

export function submitSighting(
  reportPublicId: string,
  data: {
    seen_at: string;
    location_description?: string;
    latitude?: number | null;
    longitude?: number | null;
    confidence: 'LOW' | 'MEDIUM' | 'HIGH';
    notes?: string;
    photo?: File | null;
  },
): Promise<{ id: string }> {
  const { photo, ...fields } = data;
  const clean = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ) as Record<string, string | number>;

  if (photo) {
    const form = new FormData();
    Object.entries(clean).forEach(([k, v]) => form.append(k, String(v)));
    form.append('photo', photo);
    return apiRequest(`/api/public/reports/${reportPublicId}/sightings/`, {
      method: 'POST',
      body: form,
    });
  }

  return apiRequest(`/api/public/reports/${reportPublicId}/sightings/`, {
    method: 'POST',
    body: JSON.stringify(clean),
  });
}
