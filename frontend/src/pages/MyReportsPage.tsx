import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { fetchOwnedReports, type OwnedReport } from '../services/reportsApi';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  MISSING: { label: 'Missing', bg: 'bg-error-container', text: 'text-on-error-container', icon: 'search' },
  RECENTLY_SEEN: { label: 'Recently Seen', bg: 'bg-secondary-container', text: 'text-on-secondary-container', icon: 'visibility' },
  FOUND: { label: 'Found', bg: 'bg-[#2D8C3C]/20', text: 'text-[#2D8C3C]', icon: 'check_circle' },
  CLOSED: { label: 'Closed', bg: 'bg-surface-container-high', text: 'text-secondary', icon: 'lock' },
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

interface ReportCardProps {
  report: OwnedReport;
}

function ReportCard({ report }: ReportCardProps) {
  const status = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.MISSING;

  return (
    <Link
      to={`/my-reports/${report.id}`}
      className="block bg-white rounded-2xl border border-surface-container-highest shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
    >
      <div className="p-md space-y-sm">
        <div className="flex items-start justify-between gap-sm">
          <h2 className="font-headline-md text-headline-md text-on-surface group-hover:text-primary transition-colors">
            {report.cat_name}
          </h2>
          <span
            className={`shrink-0 inline-flex items-center gap-xs px-sm py-xs rounded-full font-label-sm text-label-sm ${status.bg} ${status.text}`}
          >
            <span className="material-symbols-outlined text-[14px]">{status.icon}</span>
            {status.label}
          </span>
        </div>

        {report.last_seen_address && (
          <div className="flex items-center gap-xs text-secondary font-body-md text-body-md">
            <span className="material-symbols-outlined text-[16px] text-primary">location_on</span>
            <span className="truncate">{report.last_seen_address}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-sm border-t border-surface-container">
          <span className="text-secondary font-body-sm text-body-sm">
            Reported {timeAgo(report.created_at)}
          </span>
          {report.is_active_search && (
            <span className="inline-flex items-center gap-xs text-primary font-label-sm text-label-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Active
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function MyReportsPage() {
  const [reports, setReports] = useState<OwnedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchOwnedReports()
      .then(setReports)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const active = reports.filter((r) => r.is_active_search);
  const resolved = reports.filter((r) => !r.is_active_search);

  return (
    <div className="bg-background text-on-background font-body-md scroll-smooth min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow pt-28 pb-xl px-margin-mobile md:px-xl">
        <div className="max-w-container-max mx-auto space-y-xl">

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
            <div>
              <p className="text-label-md font-label-md text-primary uppercase tracking-widest mb-sm">
                Your account
              </p>
              <h1 className="font-display-lg text-display-lg text-on-surface">My Reports</h1>
            </div>
            <Link
              to="/report-missing"
              className="inline-flex items-center gap-xs px-lg py-md rounded-xl bg-primary-container text-white font-label-md hover:brightness-110 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              New report
            </Link>
          </div>

          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-surface-container-high rounded-2xl h-36 animate-pulse" />
              ))}
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-xl gap-md text-center">
              <span className="material-symbols-outlined text-[64px] text-secondary">error</span>
              <p className="font-headline-sm text-headline-sm text-on-surface">Failed to load reports</p>
              <p className="font-body-md text-body-md text-secondary">Please try refreshing the page.</p>
            </div>
          )}

          {!loading && !error && reports.length === 0 && (
            <div className="flex flex-col items-center justify-center py-xl gap-md text-center">
              <span className="material-symbols-outlined text-[64px] text-secondary">pets</span>
              <h2 className="font-headline-md text-headline-md text-on-surface">No reports yet</h2>
              <p className="font-body-lg text-body-lg text-secondary max-w-md">
                When you report a missing cat, it will appear here so you can track sightings and updates.
              </p>
              <Link
                to="/report-missing"
                className="mt-sm px-xl py-md rounded-xl bg-primary-container text-white font-label-md hover:brightness-110 transition-all"
              >
                Report a missing cat
              </Link>
            </div>
          )}

          {active.length > 0 && (
            <section aria-labelledby="active-heading">
              <h2 id="active-heading" className="font-label-md text-label-md text-secondary uppercase tracking-widest mb-md">
                Active searches
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
                {active.map((r) => <ReportCard key={r.id} report={r} />)}
              </div>
            </section>
          )}

          {resolved.length > 0 && (
            <section aria-labelledby="resolved-heading">
              <h2 id="resolved-heading" className="font-label-md text-label-md text-secondary uppercase tracking-widest mb-md">
                Resolved
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
                {resolved.map((r) => <ReportCard key={r.id} report={r} />)}
              </div>
            </section>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}
