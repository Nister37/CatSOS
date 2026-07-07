import { useEffect, useState } from 'react';

import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { useAppDispatch } from '../app/hooks';
import { addNotification } from '../features/notifications/notificationsSlice';
import {
  downloadReportPoster,
  fetchOwnedReports,
  generateQRCode,
  type OwnedReport,
  type QRCodePayload,
} from '../services/reportsApi';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  MISSING: { label: 'Missing', color: '#b52330' },
  RECENTLY_SEEN: { label: 'Recently Seen', color: '#d97706' },
  FOUND: { label: 'Found', color: '#2D8C3C' },
  CLOSED: { label: 'Closed', color: '#5f5e5e' },
};

function slugify(name: string) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'lost-cat';
}

interface CatCardProps {
  report: OwnedReport;
  selected: boolean;
  onSelect: () => void;
}

function CatCard({ report, selected, onSelect }: CatCardProps) {
  const status = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.MISSING;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full text-left flex items-center gap-md p-md rounded-2xl border-2 transition-all ${
        selected
          ? 'border-primary-container bg-primary-container/10 shadow-md'
          : 'border-surface-container-highest bg-white hover:border-outline-variant hover:shadow-sm'
      }`}
    >
      {/* Avatar */}
      <div className="w-14 h-14 rounded-xl overflow-hidden bg-surface-container shrink-0 flex items-center justify-center">
        <span className="material-symbols-outlined text-[32px] text-secondary">pets</span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-headline-sm text-on-surface truncate">{report.cat_name}</p>
        <p className="font-body-sm text-secondary truncate">{report.last_seen_address || 'No address'}</p>
        <span
          className="inline-block mt-xs font-label-sm text-label-sm px-sm py-[2px] rounded-full text-white"
          style={{ background: status.color }}
        >
          {status.label}
        </span>
      </div>

      {selected && (
        <span className="material-symbols-outlined text-primary-container text-[24px] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
          check_circle
        </span>
      )}
    </button>
  );
}

interface PreviewPanelProps {
  report: OwnedReport;
}

function PreviewPanel({ report }: PreviewPanelProps) {
  const dispatch = useAppDispatch();
  const [qr, setQr] = useState<QRCodePayload | null>(null);
  const [loadingQr, setLoadingQr] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    generateQRCode(report.id)
      .then(setQr)
      .catch(() => dispatch(addNotification('Could not load QR code.', 'error')))
      .finally(() => setLoadingQr(false));
  }, [report.id, dispatch]);

  async function handleDownloadPoster() {
    setGeneratingPdf(true);
    try {
      await downloadReportPoster(report.id, `${slugify(report.cat_name)}-poster.pdf`);
      dispatch(addNotification('Poster downloaded successfully.', 'success'));
    } catch {
      dispatch(addNotification('Failed to generate poster. Please try again.', 'error'));
    } finally {
      setGeneratingPdf(false);
    }
  }

  function handleDownloadQR() {
    if (!qr) return;
    const a = document.createElement('a');
    a.href = qr.qr_code;
    a.download = `${slugify(report.cat_name)}-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const status = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.MISSING;

  return (
    <div className="space-y-md">
      {/* Mini poster preview */}
      <div className="bg-white rounded-2xl border border-surface-container-highest shadow-sm overflow-hidden">
        {/* Poster header */}
        <div className="bg-on-background px-lg py-md text-center">
          <p className="font-label-sm text-label-sm text-on-primary/60 uppercase tracking-widest mb-xs">Missing Cat</p>
          <p className="font-display-lg text-[28px] text-on-primary leading-tight">{report.cat_name}</p>
        </div>

        <div className="p-md flex gap-md">
          {/* Cat info */}
          <div className="flex-1 space-y-sm min-w-0">
            <div className="flex items-center gap-xs">
              <span
                className="inline-block font-label-sm text-label-sm px-sm py-[2px] rounded-full text-white"
                style={{ background: status.color }}
              >
                {status.label}
              </span>
            </div>

            {report.last_seen_address && (
              <div className="flex items-start gap-xs text-secondary font-body-sm text-body-sm">
                <span className="material-symbols-outlined text-[14px] text-primary mt-[2px] shrink-0">location_on</span>
                <span className="truncate">{report.last_seen_address}</span>
              </div>
            )}

            {report.disappeared_at && (
              <div className="flex items-center gap-xs text-secondary font-body-sm text-body-sm">
                <span className="material-symbols-outlined text-[14px] shrink-0">calendar_today</span>
                Missing since{' '}
                {new Date(report.disappeared_at).toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            )}

            {report.description && (
              <p className="font-body-sm text-body-sm text-secondary line-clamp-3">{report.description}</p>
            )}

            {(report.contact_phone || report.contact_email) && (
              <div className="pt-sm border-t border-surface-container space-y-xs">
                <p className="font-label-sm text-label-sm text-secondary uppercase tracking-widest">Contact</p>
                {report.contact_phone && (
                  <p className="font-body-sm text-body-sm text-on-surface">{report.contact_phone}</p>
                )}
                {report.contact_email && (
                  <p className="font-body-sm text-body-sm text-on-surface">{report.contact_email}</p>
                )}
              </div>
            )}
          </div>

          {/* QR code */}
          <div className="shrink-0 flex flex-col items-center gap-xs">
            <div className="w-24 h-24 rounded-xl overflow-hidden border border-outline-variant flex items-center justify-center bg-surface-container">
              {loadingQr ? (
                <span className="material-symbols-outlined text-[32px] text-secondary animate-spin">progress_activity</span>
              ) : qr ? (
                <img src={qr.qr_code} alt="QR code for this report" className="w-full h-full object-contain" />
              ) : (
                <span className="material-symbols-outlined text-[32px] text-secondary">qr_code</span>
              )}
            </div>
            <p className="font-label-sm text-[10px] text-secondary text-center leading-tight max-w-[96px]">
              Scan for live updates
            </p>
          </div>
        </div>

        <div className="px-md pb-md">
          <p className="font-label-sm text-[10px] text-secondary/60 border-t border-surface-container pt-sm">
            CatSOS public poster — verify details on the QR-linked report page.
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <button
        type="button"
        onClick={handleDownloadPoster}
        disabled={generatingPdf}
        className="w-full flex items-center justify-center gap-sm px-xl py-md rounded-xl bg-on-background text-on-primary font-label-md text-label-md hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {generatingPdf ? (
          <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
        ) : (
          <span className="material-symbols-outlined text-[20px]">download</span>
        )}
        {generatingPdf ? 'Generating…' : 'Download Poster (PDF)'}
      </button>

      <button
        type="button"
        onClick={handleDownloadQR}
        disabled={!qr || loadingQr}
        className="w-full flex items-center justify-center gap-sm px-xl py-md rounded-xl border-2 border-outline-variant text-on-surface font-label-md text-label-md hover:bg-surface-container disabled:opacity-40 transition-colors"
      >
        <span className="material-symbols-outlined text-[20px]">qr_code</span>
        Download QR Code (PNG)
      </button>

      {qr && (
        <div className="flex items-center gap-sm p-sm bg-surface-container-low rounded-xl">
          <span className="material-symbols-outlined text-[16px] text-secondary shrink-0">link</span>
          <p className="font-body-sm text-body-sm text-secondary truncate">{qr.public_url}</p>
          <button
            type="button"
            aria-label="Copy link"
            onClick={() => {
              navigator.clipboard.writeText(qr.public_url);
              dispatch(addNotification('Link copied to clipboard.', 'success'));
            }}
            className="shrink-0 p-xs rounded-lg hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">content_copy</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function GeneratePosterPage() {
  const [reports, setReports] = useState<OwnedReport[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOwnedReports()
      .then((data) => {
        setReports(data);
        if (data.length === 1) setSelectedId(data[0].id);
      })
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  const selectedReport = reports?.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="bg-background text-on-background font-body-md scroll-smooth min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow pt-28 pb-xl px-margin-mobile md:px-xl">
        <div className="max-w-container-max mx-auto">

          {/* Header */}
          <div className="mb-xl">
            <p className="font-label-md text-label-md text-primary uppercase tracking-widest mb-sm">Your account</p>
            <h1 className="font-display-lg text-display-lg text-on-surface mb-sm">Generate Poster</h1>
            <p className="font-body-lg text-body-lg text-secondary max-w-2xl">
              Create a printable "Missing Cat" poster for your report with a QR code that links directly to the live public page — so anyone who scans it can submit a sighting instantly.
            </p>
          </div>

          {loading && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-xl">
              <div className="space-y-md">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-surface-container-high rounded-2xl animate-pulse" />
                ))}
              </div>
              <div className="h-96 bg-surface-container-high rounded-2xl animate-pulse" />
            </div>
          )}

          {!loading && reports?.length === 0 && (
            <div className="flex flex-col items-center py-xl gap-md text-center">
              <span className="material-symbols-outlined text-[64px] text-secondary">picture_as_pdf</span>
              <h2 className="font-headline-md text-headline-md text-on-surface">No reports yet</h2>
              <p className="font-body-lg text-body-lg text-secondary max-w-md">
                You need to report a missing cat before you can generate a poster.
              </p>
              <a
                href="/report-missing"
                className="mt-sm px-xl py-md rounded-xl bg-primary-container text-on-primary font-label-md hover:brightness-110 transition-all"
              >
                Report a Missing Cat
              </a>
            </div>
          )}

          {!loading && reports && reports.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-xl items-start">

              {/* Left — cat selector */}
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface mb-md flex items-center gap-sm">
                  <span className="w-6 h-6 rounded-full bg-primary-container flex items-center justify-center shrink-0">
                    <span className="font-label-md text-[11px] text-on-primary">1</span>
                  </span>
                  Select a cat
                </h2>
                <div className="space-y-sm">
                  {reports.map((report) => (
                    <CatCard
                      key={report.id}
                      report={report}
                      selected={selectedId === report.id}
                      onSelect={() => setSelectedId(report.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Right — preview + download */}
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface mb-md flex items-center gap-sm">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${selectedReport ? 'bg-primary-container' : 'bg-surface-container-high'}`}>
                    <span className={`font-label-md text-[11px] ${selectedReport ? 'text-on-primary' : 'text-secondary'}`}>2</span>
                  </span>
                  Preview &amp; Download
                </h2>

                {!selectedReport ? (
                  <div className="flex flex-col items-center justify-center gap-md py-xl text-center bg-surface-container-low rounded-2xl border-2 border-dashed border-outline-variant">
                    <span className="material-symbols-outlined text-[48px] text-secondary">picture_as_pdf</span>
                    <p className="font-body-lg text-body-lg text-secondary">Select a cat on the left to preview the poster</p>
                  </div>
                ) : (
                  <PreviewPanel key={selectedReport.id} report={selectedReport} />
                )}
              </div>
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}
