import type { ReportStep1Data } from '../schemas/reportStep1Schema';
import type { ReportStep2Data } from '../schemas/reportStep2Schema';
import type { ReportStep3Data } from '../schemas/reportStep3Schema';
import { apiRequest } from '../api/client';

type CreateReportPayload = {
  step1: ReportStep1Data;
  step2: ReportStep2Data;
  step3: ReportStep3Data;
};

export type PublicReport = {
  public_id: string;
  cat_name: string;
  location_summary: string;
  last_seen_landmark: string;
  disappeared_at: string | null;
  main_photo: { url: string } | null;
  status: string;
};

export function createReport({ step1, step2, step3 }: CreateReportPayload) {
  const payload = {
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

  return apiRequest<unknown>('/api/reports/', {
    method: 'POST',
    body: JSON.stringify(payload),
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
