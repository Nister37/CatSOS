import { useEffect, useState } from 'react';
import { CircleMarker, MapContainer, Marker, Popup } from 'react-leaflet';
import { BaseTileLayer } from '../components/BaseTileLayer';
import { Link, useParams } from 'react-router-dom';

import { useAppDispatch } from '../app/hooks';
import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { NearbyHelpSection } from '../components/NearbyHelpSection';
import { addNotification } from '../features/notifications/notificationsSlice';
import {
  fetchOwnedReport,
  fetchReportSightings,
  fetchReportTimeline,
  verifySighting,
  type OwnedReport,
  type OwnedSighting,
  type TimelineEvent,
} from '../services/reportsApi';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  MISSING: { label: 'Missing', bg: 'bg-error-container', text: 'text-on-error-container', icon: 'search' },
  RECENTLY_SEEN: { label: 'Recently Seen', bg: 'bg-secondary-container', text: 'text-on-secondary-container', icon: 'visibility' },
  FOUND: { label: 'Found', bg: 'bg-[#2D8C3C]/20', text: 'text-[#2D8C3C]', icon: 'check_circle' },
  CLOSED: { label: 'Closed', bg: 'bg-surface-container-high', text: 'text-secondary', icon: 'lock' },
};

const VERIFICATION_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  PENDING: { label: 'Pending review', bg: 'bg-secondary-container', text: 'text-on-secondary-container' },
  USEFUL: { label: 'Confirmed useful', bg: 'bg-[#2D8C3C]/20', text: 'text-[#2D8C3C]' },
  FALSE: { label: 'Marked false', bg: 'bg-error-container', text: 'text-on-error-container' },
};

const CONFIDENCE_LABELS: Record<string, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };

const TIMELINE_ICON: Record<string, string> = {
  REPORT_CREATED: 'flag',
  STATUS_CHANGED: 'swap_horiz',
  SIGHTING_CREATED: 'location_on',
  SIGHTING_MARKED_USEFUL: 'thumb_up',
  SIGHTING_MARKED_FALSE: 'thumb_down',
  VOLUNTEER_SEARCH_STARTED: 'directions_run',
};

const TIMELINE_LABEL: Record<string, string> = {
  REPORT_CREATED: 'Report created',
  STATUS_CHANGED: 'Status changed',
  SIGHTING_CREATED: 'New sighting reported',
  SIGHTING_MARKED_USEFUL: 'Sighting marked useful',
  SIGHTING_MARKED_FALSE: 'Sighting marked false',
  VOLUNTEER_SEARCH_STARTED: 'Volunteer joined the search',
};

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

interface ReportHeaderProps {
  report: OwnedReport;
}

function ReportHeader({ report }: ReportHeaderProps) {
  const status = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.MISSING;
  return (
    <div className="space-y-sm">
      <div className="flex flex-wrap items-center gap-sm">
        <span
          className={`inline-flex items-center gap-xs px-sm py-xs rounded-full font-label-md text-label-md ${status.bg} ${status.text}`}
        >
          <span className="material-symbols-outlined text-[16px]">{status.icon}</span>
          {status.label}
        </span>
        {report.is_active_search && (
          <span className="inline-flex items-center gap-xs text-primary font-label-md text-label-md">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Active search
          </span>
        )}
      </div>
      <h1 className="font-display-lg text-display-lg text-on-surface">{report.cat_name}</h1>
      {report.disappeared_at && (
        <p className="font-body-lg text-body-lg text-secondary">
          Missing since {formatDate(report.disappeared_at)}
        </p>
      )}
      <p className="font-body-md text-body-md text-secondary">
        Report posted {formatDate(report.created_at)}
      </p>
    </div>
  );
}

interface DetailCardProps {
  report: OwnedReport;
}

function DetailCard({ report }: DetailCardProps) {
  const rows: { label: string; value: string | null | undefined }[] = [
    { label: 'Breed', value: report.breed || 'Not specified' },
    { label: 'Coat colour', value: report.coat_color || 'Not specified' },
    { label: 'Eye colour', value: report.eye_color || 'Not specified' },
    {
      label: 'Microchip',
      value: report.has_microchip ? `Yes${report.chip_number ? ` — ${report.chip_number}` : ''}` : 'No',
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-surface-container-highest shadow-sm p-md md:p-lg space-y-md">
      <h2 className="font-headline-md text-headline-md text-on-surface">Cat Details</h2>

      {report.description && (
        <p className="font-body-md text-body-md text-secondary">{report.description}</p>
      )}

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
        {rows.map(({ label, value }) => (
          <div key={label} className="bg-surface-container-low rounded-xl p-sm space-y-xs">
            <dt className="font-label-sm text-label-sm text-secondary uppercase tracking-wide">{label}</dt>
            <dd className="font-body-md text-body-md text-on-surface">{value}</dd>
          </div>
        ))}
      </dl>

      {report.last_seen_address && (
        <div className="flex items-start gap-sm pt-sm border-t border-surface-container">
          <span className="material-symbols-outlined text-primary mt-xs">location_on</span>
          <div>
            <p className="font-label-sm text-label-sm text-secondary uppercase tracking-wide">Last seen</p>
            <p className="font-body-md text-body-md text-on-surface">{report.last_seen_address}</p>
            {report.last_seen_landmark && (
              <p className="font-body-sm text-body-sm text-secondary mt-xs">{report.last_seen_landmark}</p>
            )}
          </div>
        </div>
      )}

      {report.reward_amount && (
        <div className="flex items-start gap-sm pt-sm border-t border-surface-container">
          <span className="material-symbols-outlined text-primary mt-xs">monetization_on</span>
          <div>
            <p className="font-label-sm text-label-sm text-secondary uppercase tracking-wide">Reward</p>
            <p className="font-body-md text-body-md text-on-surface">{report.reward_amount}</p>
            {report.reward_note && (
              <p className="font-body-sm text-body-sm text-secondary mt-xs">{report.reward_note}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface SightingCardProps {
  sighting: OwnedSighting;
  verifyingId: string | null;
  onVerify: (sightingId: string, status: 'USEFUL' | 'FALSE') => void;
}

function SightingCard({ sighting, verifyingId, onVerify }: SightingCardProps) {
  const verification = VERIFICATION_CONFIG[sighting.verification_status] ?? VERIFICATION_CONFIG.PENDING;
  const isPending = sighting.verification_status === 'PENDING';
  const isVerifying = verifyingId === sighting.id;

  return (
    <div className="bg-white rounded-2xl border border-surface-container-highest shadow-sm overflow-hidden">
      {sighting.photos.length > 0 && (
        <div className="h-48 overflow-hidden bg-surface-container">
          <img
            src={sighting.photos[0].url}
            alt="Evidence from this sighting"
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-md space-y-sm">
        <div className="flex items-start justify-between gap-sm">
          <div className="space-y-xs">
            <div className="flex items-center gap-xs text-secondary font-body-sm text-body-sm">
              <span className="material-symbols-outlined text-[16px]">schedule</span>
              {timeAgo(sighting.seen_at)}
              {sighting.submitted_by && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-container text-white font-label-sm text-[10px]">
                    {sighting.submitted_by.avatar_fallback}
                  </span>
                  <span>{sighting.submitted_by.display_name}</span>
                </>
              )}
            </div>
            {sighting.location_description && (
              <div className="flex items-center gap-xs text-on-surface font-body-md text-body-md">
                <span className="material-symbols-outlined text-[16px] text-primary">location_on</span>
                {sighting.location_description}
              </div>
            )}
          </div>
          <span
            className={`shrink-0 inline-flex items-center px-sm py-xs rounded-full font-label-sm text-label-sm ${verification.bg} ${verification.text}`}
          >
            {verification.label}
          </span>
        </div>

        <div className="flex items-center gap-xs text-secondary font-body-sm text-body-sm">
          <span className="material-symbols-outlined text-[16px]">signal_cellular_alt</span>
          Confidence: {CONFIDENCE_LABELS[sighting.confidence] ?? sighting.confidence}
        </div>

        {sighting.notes && (
          <p className="font-body-md text-body-md text-on-surface border-t border-surface-container pt-sm">
            {sighting.notes}
          </p>
        )}

        {isPending && (
          <div className="flex gap-sm pt-sm border-t border-surface-container">
            <button
              type="button"
              disabled={!!verifyingId}
              onClick={() => onVerify(sighting.id, 'USEFUL')}
              className="flex-1 flex items-center justify-center gap-xs py-sm rounded-xl bg-[#2D8C3C]/10 text-[#2D8C3C] font-label-md text-label-md hover:bg-[#2D8C3C]/20 transition-colors disabled:opacity-50"
            >
              {isVerifying ? (
                <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
              ) : (
                <span className="material-symbols-outlined text-[16px]">thumb_up</span>
              )}
              Useful
            </button>
            <button
              type="button"
              disabled={!!verifyingId}
              onClick={() => onVerify(sighting.id, 'FALSE')}
              className="flex-1 flex items-center justify-center gap-xs py-sm rounded-xl bg-error-container text-on-error-container font-label-md text-label-md hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {isVerifying ? (
                <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
              ) : (
                <span className="material-symbols-outlined text-[16px]">thumb_down</span>
              )}
              False
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface TimelineProps {
  events: TimelineEvent[];
}

function Timeline({ events }: TimelineProps) {
  if (events.length === 0) {
    return (
      <p className="text-secondary font-body-md text-body-md py-md">No activity yet.</p>
    );
  }

  return (
    <ol className="space-y-0">
      {events.map((event, index) => {
        const icon = TIMELINE_ICON[event.event_type] ?? 'circle';
        const label = TIMELINE_LABEL[event.event_type] ?? event.event_type;
        const isLast = index === events.length - 1;

        return (
          <li key={event.id} className="flex gap-md">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white text-[16px]">{icon}</span>
              </div>
              {!isLast && <div className="w-px flex-grow bg-surface-container-high mt-xs" />}
            </div>
            <div className={`pb-lg ${isLast ? '' : ''}`}>
              <p className="font-label-md text-label-md text-on-surface">{label}</p>
              {event.event_type === 'STATUS_CHANGED' && event.from_status && event.to_status && (
                <p className="font-body-sm text-body-sm text-secondary mt-xs">
                  {event.from_status} → {event.to_status}
                </p>
              )}
              {event.location_summary && (
                <p className="font-body-sm text-body-sm text-secondary mt-xs">{event.location_summary}</p>
              )}
              {event.actor && (
                <p className="font-body-sm text-body-sm text-secondary mt-xs">
                  by {event.actor.display_name}
                </p>
              )}
              <p className="font-body-sm text-body-sm text-secondary mt-xs">{timeAgo(event.created_at)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`bg-surface-container-high rounded-xl animate-pulse ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-lg">
      <SkeletonBlock className="h-8 w-48" />
      <SkeletonBlock className="h-12 w-2/3" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg mt-lg">
        <div className="lg:col-span-4 space-y-md">
          <SkeletonBlock className="h-64" />
          <SkeletonBlock className="h-32" />
        </div>
        <div className="lg:col-span-8 space-y-md">
          <SkeletonBlock className="h-48" />
          <SkeletonBlock className="h-48" />
        </div>
      </div>
    </div>
  );
}

export function MyReportPage() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();

  const [report, setReport] = useState<OwnedReport | null>(null);
  const [sightings, setSightings] = useState<OwnedSighting[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchOwnedReport(id),
      fetchReportSightings(id),
      fetchReportTimeline(id),
    ])
      .then(([reportData, sightingsData, timelineData]) => {
        setReport(reportData);
        setSightings(sightingsData);
        setTimeline(timelineData);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleVerify(sightingId: string, status: 'USEFUL' | 'FALSE') {
    if (!id || verifyingId) return;
    setVerifyingId(sightingId);
    try {
      await verifySighting(id, sightingId, status);
      setSightings((prev) =>
        prev.map((s) => (s.id === sightingId ? { ...s, verification_status: status } : s)),
      );
      dispatch(addNotification('Sighting updated.', 'success'));
    } catch {
      dispatch(addNotification('Failed to update sighting.', 'error'));
    } finally {
      setVerifyingId(null);
    }
  }

  const pendingSightings = sightings.filter((s) => s.verification_status === 'PENDING');
  const reviewedSightings = sightings.filter((s) => s.verification_status !== 'PENDING');

  return (
    <div className="bg-background text-on-background font-body-md scroll-smooth min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow pt-28 pb-xl px-margin-mobile md:px-xl">
        <div className="max-w-container-max mx-auto">

          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-lg">
            <ol className="flex items-center gap-xs text-secondary font-body-sm text-body-sm">
              <li>
                <Link to="/" className="hover:text-on-surface transition-colors">Home</Link>
              </li>
              <li aria-hidden="true">
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              </li>
              <li>
                <span className="text-on-surface">{report?.cat_name ?? 'My Report'}</span>
              </li>
            </ol>
          </nav>

          {loading && <LoadingSkeleton />}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-xl gap-md text-center">
              <span className="material-symbols-outlined text-[64px] text-secondary">error</span>
              <h2 className="font-headline-md text-headline-md text-on-surface">Report not found</h2>
              <p className="font-body-lg text-body-lg text-secondary max-w-md">
                This report may have been removed or you may not have permission to view it.
              </p>
              <Link
                to="/"
                className="mt-sm px-xl py-md rounded-xl bg-primary-container text-white font-label-md hover:brightness-110 transition-all"
              >
                Back to home
              </Link>
            </div>
          )}

          {report && !loading && (
            <>
              {/* Page header */}
              <div className="mb-xl">
                <ReportHeader report={report} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
                {/* Left column */}
                <div className="lg:col-span-4 space-y-lg">
                  <DetailCard report={report} />

                  {/* Timeline */}
                  <div className="bg-white rounded-2xl border border-surface-container-highest shadow-sm p-md md:p-lg">
                    <h2 className="font-headline-md text-headline-md text-on-surface mb-md">
                      Activity Timeline
                    </h2>
                    <Timeline events={timeline} />
                  </div>

                  {/* Nearby Help */}
                  {report.last_seen_lat != null && report.last_seen_lng != null && (
                    <NearbyHelpSection lat={report.last_seen_lat} lng={report.last_seen_lng} />
                  )}
                </div>

                {/* Right column — map + sightings */}
                <div className="lg:col-span-8 space-y-lg">

                  {/* Map */}
                  {(report.last_seen_lat != null && report.last_seen_lng != null) && (
                    <div className="bg-white rounded-2xl border border-surface-container-highest shadow-sm overflow-hidden">
                      <div className="px-md pt-md pb-sm flex items-center justify-between">
                        <h2 className="font-headline-md text-headline-md text-on-surface">Sightings Map</h2>
                        <span className="text-secondary font-body-sm text-body-sm">
                          {sightings.filter(s => s.latitude != null).length} sighting{sightings.filter(s => s.latitude != null).length !== 1 ? 's' : ''} plotted
                        </span>
                      </div>
                      <div className="h-72 w-full" style={{ isolation: 'isolate' }}>
                        <MapContainer
                          center={[report.last_seen_lat, report.last_seen_lng]}
                          zoom={13}
                          scrollWheelZoom={false}
                          className="w-full h-full"
                          aria-label={`Map showing last known location and sightings of ${report.cat_name}`}
                        >
                          <BaseTileLayer />
                          <Marker position={[report.last_seen_lat, report.last_seen_lng]}>
                            <Popup>
                              <strong>Last seen here</strong>
                              {report.last_seen_address && <><br />{report.last_seen_address}</>}
                            </Popup>
                          </Marker>
                          {sightings
                            .filter(s => s.latitude != null && s.longitude != null)
                            .map(s => (
                              <CircleMarker
                                key={s.id}
                                center={[s.latitude!, s.longitude!]}
                                radius={10}
                                pathOptions={{
                                  color: s.verification_status === 'USEFUL' ? '#2D8C3C' : s.verification_status === 'FALSE' ? '#b52330' : '#d97706',
                                  fillColor: s.verification_status === 'USEFUL' ? '#2D8C3C' : s.verification_status === 'FALSE' ? '#b52330' : '#d97706',
                                  fillOpacity: 0.8,
                                }}
                              >
                                <Popup>
                                  <strong>Sighting</strong><br />
                                  {s.location_description || 'No description'}<br />
                                  <span style={{ textTransform: 'capitalize', fontSize: 12 }}>
                                    {s.verification_status.toLowerCase()} · {CONFIDENCE_LABELS[s.confidence]} confidence
                                  </span>
                                </Popup>
                              </CircleMarker>
                            ))
                          }
                        </MapContainer>
                      </div>
                      <div className="px-md py-sm flex items-center gap-lg border-t border-surface-container text-label-sm font-label-sm text-secondary">
                        <span className="flex items-center gap-xs"><span className="w-3 h-3 rounded-full bg-on-background inline-block" /> Last seen</span>
                        <span className="flex items-center gap-xs"><span className="w-3 h-3 rounded-full bg-[#2D8C3C] inline-block" /> Useful</span>
                        <span className="flex items-center gap-xs"><span className="w-3 h-3 rounded-full bg-[#d97706] inline-block" /> Pending</span>
                        <span className="flex items-center gap-xs"><span className="w-3 h-3 rounded-full bg-[#b52330] inline-block" /> False</span>
                      </div>
                    </div>
                  )}

                  {/* Sightings summary bar */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-headline-md text-headline-md text-on-surface">
                        Sightings
                      </h2>
                      <p className="font-body-md text-body-md text-secondary mt-xs">
                        {sightings.length === 0
                          ? 'No sightings reported yet.'
                          : `${sightings.length} sighting${sightings.length !== 1 ? 's' : ''} reported`}
                        {pendingSightings.length > 0 && (
                          <span className="ml-sm inline-flex items-center gap-xs text-primary">
                            · {pendingSightings.length} awaiting your review
                          </span>
                        )}
                      </p>
                    </div>
                    <Link
                      to={`/map`}
                      className="flex items-center gap-xs px-md py-sm rounded-xl bg-surface-container border border-outline-variant text-on-surface font-label-md hover:bg-secondary-container transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">map</span>
                      View map
                    </Link>
                  </div>

                  {sightings.length === 0 && (
                    <div className="bg-surface-container-low rounded-2xl p-xl flex flex-col items-center text-center gap-sm border border-surface-container-highest">
                      <span className="material-symbols-outlined text-[48px] text-secondary">
                        search_off
                      </span>
                      <p className="font-headline-sm text-headline-sm text-on-surface">
                        No sightings yet
                      </p>
                      <p className="font-body-md text-body-md text-secondary max-w-sm">
                        Community members can report sightings of {report.cat_name} on the public map.
                        You'll be notified as soon as one comes in.
                      </p>
                    </div>
                  )}

                  {pendingSightings.length > 0 && (
                    <section aria-labelledby="pending-heading">
                      <h3 id="pending-heading" className="font-label-md text-label-md text-secondary uppercase tracking-widest mb-md">
                        Needs review
                      </h3>
                      <div className="space-y-md">
                        {pendingSightings.map((s) => (
                          <SightingCard
                            key={s.id}
                            sighting={s}

                            verifyingId={verifyingId}
                            onVerify={handleVerify}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {reviewedSightings.length > 0 && (
                    <section aria-labelledby="reviewed-heading">
                      <h3 id="reviewed-heading" className="font-label-md text-label-md text-secondary uppercase tracking-widest mb-md">
                        Reviewed sightings
                      </h3>
                      <div className="space-y-md">
                        {reviewedSightings.map((s) => (
                          <SightingCard
                            key={s.id}
                            sighting={s}

                            verifyingId={verifyingId}
                            onVerify={handleVerify}
                          />
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
