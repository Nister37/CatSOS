import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAppDispatch } from '../app/hooks';
import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { addNotification } from '../features/notifications/notificationsSlice';
import {
  fetchNotifications,
  markNotificationRead,
  type BackendNotification,
} from '../services/notificationsApi';
import { verifySighting } from '../services/reportsApi';

const EVENT_ICON: Record<string, string> = {
  REPORT_CREATED: 'flag',
  REPORT_STATUS_CHANGED: 'swap_horiz',
  SIGHTING_CREATED: 'location_on',
  SIGHTING_MARKED_USEFUL: 'thumb_up',
  SIGHTING_MARKED_FALSE: 'thumb_down',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  LOW: 'Low confidence',
  MEDIUM: 'Medium confidence',
  HIGH: 'High confidence',
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

interface NotificationCardProps {
  notification: BackendNotification;
  verifyingId: string | null;
  onRead: (id: string) => void;
  onVerify: (
    reportId: string,
    sightingId: string,
    status: 'USEFUL' | 'FALSE',
    notificationId: string,
  ) => void;
}

function NotificationCard({ notification, verifyingId, onRead, onVerify }: NotificationCardProps) {
  const icon = EVENT_ICON[notification.event_type] ?? 'notifications';
  const isSightingPending =
    notification.event_type === 'SIGHTING_CREATED' &&
    notification.sighting?.verification_status === 'PENDING' &&
    notification.sighting?.id &&
    notification.report?.id;

  const isVerifying = verifyingId === notification.sighting?.id;

  function handleClick() {
    if (!notification.is_read) onRead(notification.id);
  }

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
        notification.is_read
          ? 'border-surface-container-highest opacity-70'
          : 'border-primary/20 ring-1 ring-primary/10'
      }`}
    >
      <div className="p-md space-y-sm">
        {/* Header row */}
        <div className="flex items-start gap-md">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
              notification.is_read ? 'bg-surface-container' : 'bg-primary-container/20'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[18px] ${
                notification.is_read ? 'text-secondary' : 'text-primary-container'
              }`}
            >
              {icon}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-sm">
              <p
                className={`font-label-md text-label-md leading-snug ${
                  notification.is_read ? 'text-secondary' : 'text-on-surface'
                }`}
              >
                {notification.title}
              </p>
              <div className="flex items-center gap-sm shrink-0">
                <span className="text-secondary font-body-sm text-body-sm whitespace-nowrap">
                  {timeAgo(notification.created_at)}
                </span>
                {!notification.is_read && (
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0" aria-label="Unread" />
                )}
              </div>
            </div>

            <p className="font-body-md text-body-md text-secondary mt-xs">{notification.message}</p>

            {/* Actor */}
            {notification.actor && (
              <div className="flex items-center gap-xs mt-xs text-secondary font-body-sm text-body-sm">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-container/30 text-primary-container font-label-sm text-[10px] shrink-0">
                  {notification.actor.avatar_fallback}
                </span>
                {notification.actor.display_name}
              </div>
            )}

            {/* Sighting details */}
            {notification.sighting && (
              <div className="mt-sm p-sm bg-surface-container-low rounded-xl space-y-xs">
                {notification.sighting.location_description && (
                  <div className="flex items-center gap-xs text-on-surface font-body-sm text-body-sm">
                    <span className="material-symbols-outlined text-[14px] text-primary">location_on</span>
                    {notification.sighting.location_description}
                  </div>
                )}
                <div className="flex items-center gap-xs text-secondary font-body-sm text-body-sm">
                  <span className="material-symbols-outlined text-[14px]">signal_cellular_alt</span>
                  {CONFIDENCE_LABELS[notification.sighting.confidence] ?? notification.sighting.confidence}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-sm pt-sm border-t border-surface-container">
          {isSightingPending ? (
            <>
              <button
                type="button"
                disabled={!!verifyingId}
                onClick={() =>
                  onVerify(
                    notification.report!.id!,
                    notification.sighting!.id,
                    'USEFUL',
                    notification.id,
                  )
                }
                className="flex items-center gap-xs px-md py-xs rounded-xl bg-[#2D8C3C]/10 text-[#2D8C3C] font-label-md text-label-md hover:bg-[#2D8C3C]/20 transition-colors disabled:opacity-50"
              >
                {isVerifying ? (
                  <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-[14px]">thumb_up</span>
                )}
                Approve
              </button>
              <button
                type="button"
                disabled={!!verifyingId}
                onClick={() =>
                  onVerify(
                    notification.report!.id!,
                    notification.sighting!.id,
                    'FALSE',
                    notification.id,
                  )
                }
                className="flex items-center gap-xs px-md py-xs rounded-xl bg-error-container text-on-error-container font-label-md text-label-md hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {isVerifying ? (
                  <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-[14px]">thumb_down</span>
                )}
                False
              </button>
              <Link
                to={notification.action_url || `/my-reports/${notification.report?.id ?? ''}`}
                onClick={handleClick}
                className="ml-auto text-primary font-label-md text-label-md hover:underline"
              >
                View report
              </Link>
            </>
          ) : (
            <div className="flex items-center justify-between w-full">
              {notification.report && (
                <Link
                  to={notification.action_url || `/my-reports/${notification.report.id ?? ''}`}
                  onClick={handleClick}
                  className="text-primary font-label-md text-label-md hover:underline"
                >
                  View report
                </Link>
              )}
              {!notification.is_read && (
                <button
                  type="button"
                  onClick={handleClick}
                  className="ml-auto text-secondary font-label-sm text-label-sm hover:text-on-surface transition-colors"
                >
                  Mark as read
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function NotificationsPage() {
  const dispatch = useAppDispatch();
  const [notifications, setNotifications] = useState<BackendNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  useEffect(() => {
    fetchNotifications()
      .then(setNotifications)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  async function handleRead(notificationId: string) {
    try {
      const updated = await markNotificationRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, ...updated } : n)),
      );
    } catch {
      // non-critical, silently ignore
    }
  }

  async function handleVerify(
    reportId: string,
    sightingId: string,
    status: 'USEFUL' | 'FALSE',
    notificationId: string,
  ) {
    if (verifyingId) return;
    setVerifyingId(sightingId);
    try {
      await verifySighting(reportId, sightingId, status);
      // Update the sighting status inside the notification and mark it read
      setNotifications((prev) =>
        prev.map((n) => {
          if (n.id !== notificationId) return n;
          return {
            ...n,
            is_read: true,
            sighting: n.sighting ? { ...n.sighting, verification_status: status } : n.sighting,
          };
        }),
      );
      dispatch(
        addNotification(
          status === 'USEFUL' ? 'Sighting approved.' : 'Sighting marked as false.',
          'success',
        ),
      );
      // Fire mark-read in background
      markNotificationRead(notificationId).catch(() => {});
    } catch {
      dispatch(addNotification('Failed to update sighting. Please try again.', 'error'));
    } finally {
      setVerifyingId(null);
    }
  }

  const unread = notifications.filter((n) => !n.is_read);
  const read = notifications.filter((n) => n.is_read);

  return (
    <div className="bg-background text-on-background font-body-md scroll-smooth min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow pt-28 pb-xl px-margin-mobile md:px-xl">
        <div className="max-w-2xl mx-auto space-y-xl">

          <div className="flex items-end justify-between gap-md">
            <div>
              <p className="text-label-md font-label-md text-primary uppercase tracking-widest mb-sm">
                Your account
              </p>
              <h1 className="font-display-lg text-display-lg text-on-surface">Notifications</h1>
            </div>
            {unread.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  unread.forEach((n) => handleRead(n.id));
                }}
                className="text-secondary font-label-md text-label-md hover:text-on-surface transition-colors pb-1"
              >
                Mark all as read
              </button>
            )}
          </div>

          {loading && (
            <div className="space-y-md">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-surface-container-high rounded-2xl h-28 animate-pulse" />
              ))}
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center py-xl gap-md text-center">
              <span className="material-symbols-outlined text-[64px] text-secondary">error</span>
              <p className="font-headline-sm text-headline-sm text-on-surface">Failed to load notifications</p>
            </div>
          )}

          {!loading && !error && notifications.length === 0 && (
            <div className="flex flex-col items-center py-xl gap-md text-center">
              <span className="material-symbols-outlined text-[64px] text-secondary">notifications_off</span>
              <h2 className="font-headline-md text-headline-md text-on-surface">All caught up</h2>
              <p className="font-body-lg text-body-lg text-secondary max-w-sm">
                You'll be notified here when someone spots your cat or when your report status changes.
              </p>
            </div>
          )}

          {unread.length > 0 && (
            <section aria-labelledby="unread-heading" className="space-y-md">
              <h2 id="unread-heading" className="font-label-md text-label-md text-secondary uppercase tracking-widest">
                New · {unread.length}
              </h2>
              {unread.map((n) => (
                <NotificationCard
                  key={n.id}
                  notification={n}
                  verifyingId={verifyingId}
                  onRead={handleRead}
                  onVerify={handleVerify}
                />
              ))}
            </section>
          )}

          {read.length > 0 && (
            <section aria-labelledby="read-heading" className="space-y-md">
              <h2 id="read-heading" className="font-label-md text-label-md text-secondary uppercase tracking-widest">
                Earlier
              </h2>
              {read.map((n) => (
                <NotificationCard
                  key={n.id}
                  notification={n}
                  verifyingId={verifyingId}
                  onRead={handleRead}
                  onVerify={handleVerify}
                />
              ))}
            </section>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}
