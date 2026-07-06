import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';

import { useAppSelector } from '../app/hooks';
import { fetchReportDetail, type ReportDetail } from '../services/reportsApi';

type Props = {
  publicId: string;
  onClose: () => void;
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return 'Unknown';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    MISSING: 'Missing',
    RECENTLY_SEEN: 'Recently Seen',
    FOUND: 'Found',
    CLOSED: 'Closed',
  };
  return labels[status] ?? status;
}

export function CatDetailModal({ publicId, onClose }: Props) {
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const isLoggedIn = useAppSelector((state) => Boolean(state.auth.accessToken));
  const navigate = useNavigate();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    fetchReportDetail(publicId)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [publicId]);

  const pinIcon = useMemo(
    () =>
      new L.DivIcon({
        className: '',
        html: `<span class="material-symbols-outlined" style="font-size:36px;color:#ff5a5f;font-variation-settings:'FILL' 1;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.4));display:block;line-height:1;">location_on</span>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      }),
    [],
  );

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center p-md">
      <div
        className="absolute inset-0 bg-on-surface/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={report ? `Details for ${report.cat_name}` : 'Cat details'}
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-md right-md z-20 w-9 h-9 bg-white/90 hover:bg-surface-container rounded-full flex items-center justify-center shadow transition-colors"
        >
          <span className="material-symbols-outlined text-on-surface" style={{ fontSize: 20 }}>close</span>
        </button>

        {loading ? (
          <div className="p-xl flex flex-col gap-md animate-pulse">
            <div className="h-56 bg-surface-container rounded-xl" />
            <div className="h-6 bg-surface-container rounded-lg w-1/2" />
            <div className="h-4 bg-surface-container rounded-lg w-full" />
            <div className="h-4 bg-surface-container rounded-lg w-3/4" />
          </div>
        ) : report ? (
          <>
            <div className="relative h-56 bg-surface-container rounded-t-2xl overflow-hidden">
              {report.main_photo ? (
                <img
                  src={report.main_photo.url}
                  alt={`${report.cat_name}, a missing cat`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-secondary opacity-30" style={{ fontSize: 80 }}>pets</span>
                </div>
              )}
              <div className="absolute top-4 left-4">
                <span className={`px-3 py-1 rounded-full font-label-md text-label-md font-bold uppercase tracking-wider shadow-md text-white ${report.is_active_search ? 'bg-primary' : 'bg-secondary'}`}>
                  {statusLabel(report.status)}
                </span>
              </div>
            </div>

            <div className="p-lg space-y-lg">
              <div>
                <h2 className="font-headline-lg text-headline-lg text-on-background">{report.cat_name}</h2>
                {report.disappeared_at && (
                  <p className="font-body-md text-body-md text-secondary mt-xs">
                    Last seen {formatDate(report.disappeared_at)}
                  </p>
                )}
              </div>

              {[
                report.breed && { label: 'Breed', value: report.breed },
                report.coat_color && { label: 'Coat Color', value: report.coat_color },
                report.gender && report.gender !== 'UNKNOWN' && { label: 'Gender', value: report.gender.charAt(0) + report.gender.slice(1).toLowerCase() },
                report.eye_color && { label: 'Eye Color', value: report.eye_color },
                report.collar_description && { label: 'Collar', value: report.collar_description },
                report.has_microchip && { label: 'Microchip', value: 'Yes' },
              ].filter(Boolean).length > 0 && (
                <div className="grid grid-cols-2 gap-sm">
                  {[
                    report.breed && { label: 'Breed', value: report.breed },
                    report.coat_color && { label: 'Coat Color', value: report.coat_color },
                    report.gender && report.gender !== 'UNKNOWN' && { label: 'Gender', value: report.gender.charAt(0) + report.gender.slice(1).toLowerCase() },
                    report.eye_color && { label: 'Eye Color', value: report.eye_color },
                    report.collar_description && { label: 'Collar', value: report.collar_description },
                    report.has_microchip && { label: 'Microchip', value: 'Yes' },
                  ].filter((x): x is { label: string; value: string } => Boolean(x)).map(({ label, value }) => (
                    <div key={label} className="bg-surface-container-low rounded-xl p-sm">
                      <p className="font-label-sm text-label-sm text-secondary">{label}</p>
                      <p className="font-body-md text-body-md text-on-surface">{value}</p>
                    </div>
                  ))}
                </div>
              )}

              {report.description && (
                <div>
                  <p className="font-label-md text-label-md text-secondary mb-xs">Description</p>
                  <p className="font-body-md text-body-md text-on-surface leading-relaxed">{report.description}</p>
                </div>
              )}

              {(report.last_seen_landmark || report.approximate_location) && (
                <div className="space-y-sm">
                  <div className="flex items-center gap-xs text-primary-container">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: 20 }}>location_on</span>
                    <span className="font-label-md text-label-md">Last seen location</span>
                  </div>
                  {report.last_seen_landmark && (
                    <p className="font-body-md text-body-md text-on-surface">{report.last_seen_landmark}</p>
                  )}
                  {report.approximate_location && (
                    <>
                      <div
                        className="rounded-xl overflow-hidden border border-surface-container isolate"
                        style={{ height: 200 }}
                      >
                        <MapContainer
                          key={`${report.approximate_location.latitude},${report.approximate_location.longitude}`}
                          center={[report.approximate_location.latitude, report.approximate_location.longitude]}
                          zoom={14}
                          scrollWheelZoom={false}
                          zoomControl={false}
                          attributionControl={false}
                          style={{ height: '100%' }}
                        >
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                          <Marker
                            position={[report.approximate_location.latitude, report.approximate_location.longitude]}
                            icon={pinIcon}
                          />
                        </MapContainer>
                      </div>
                      {report.approximate_location.is_approximate && (
                        <p className="font-label-sm text-label-sm text-secondary">
                          Location is approximate to protect the owner's privacy.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {report.reward_amount && (
                <div className="bg-secondary-container/30 rounded-xl p-md flex items-center gap-md">
                  <span
                    className="material-symbols-outlined text-secondary flex-shrink-0"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    payments
                  </span>
                  <div>
                    <p className="font-label-md text-label-md text-on-surface">Reward offered</p>
                    <p className="font-body-md text-body-md text-secondary">
                      ${report.reward_amount}{report.reward_note ? ` — ${report.reward_note}` : ''}
                    </p>
                  </div>
                </div>
              )}

              <div className="border-t border-surface-container pt-md space-y-sm">
                <p className="font-label-md text-label-md text-secondary">Contact</p>
                {report.contact.visibility === 'PUBLIC' ? (
                  <div className="space-y-xs">
                    {report.contact.name && (
                      <div className="flex items-center gap-xs">
                        <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>person</span>
                        <span className="font-body-md text-body-md text-on-surface">{report.contact.name}</span>
                      </div>
                    )}
                    {report.contact.phone && (
                      <div className="flex items-center gap-xs">
                        <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>call</span>
                        <a href={`tel:${report.contact.phone}`} className="font-body-md text-body-md text-primary-container hover:underline">
                          {report.contact.phone}
                        </a>
                      </div>
                    )}
                    {report.contact.email && (
                      <div className="flex items-center gap-xs">
                        <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>mail</span>
                        <a href={`mailto:${report.contact.email}`} className="font-body-md text-body-md text-primary-container hover:underline">
                          {report.contact.email}
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="font-body-md text-body-md text-secondary">{report.contact.instructions}</p>
                )}
              </div>

              {isLoggedIn && report.is_active_search && (
                <button
                  onClick={() => {
                    onClose();
                    navigate('/report-sighting', { state: { preSelectedId: report.public_id } });
                  }}
                  className="w-full bg-primary-container text-white py-md rounded-xl font-headline-md flex items-center justify-center gap-sm hover:brightness-110 active:scale-[0.98] transition-all"
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>visibility</span>
                  I Spotted This Cat
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="p-xl text-center">
            <span className="material-symbols-outlined text-secondary opacity-40" style={{ fontSize: 48 }}>error</span>
            <p className="font-body-md text-body-md text-secondary mt-sm">Could not load report details.</p>
          </div>
        )}
      </div>
    </div>
  );
}
