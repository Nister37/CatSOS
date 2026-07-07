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

const CONFIDENCE_SHORT: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Med',
  HIGH: 'High',
};

const CONFIDENCE_COLOR: Record<string, string> = {
  LOW: 'bg-error-container text-on-error-container',
  MEDIUM: 'bg-secondary-container text-on-secondary-container',
  HIGH: 'bg-[#2D8C3C]/15 text-[#2D8C3C]',
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
        {/* Top row: icon · title · actor avatar · time · unread dot */}
        <div className="flex items-center gap-sm">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              notification.is_read ? 'bg-surface-container' : 'bg-primary-container/20'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[16px] ${
                notification.is_read ? 'text-secondary' : 'text-primary-container'
              }`}
            >
              {icon}
            </span>
          </div>

          <p
            className={`flex-1 min-w-0 font-label-md text-label-md truncate ${
              notification.is_read ? 'text-secondary' : 'text-on-surface'
            }`}
          >
            {notification.title}
          </p>

          {notification.actor && (
            <span
              title={notification.actor.display_name}
              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-container/30 text-primary-container font-label-sm text-[10px] shrink-0"
            >
              {notification.actor.avatar_fallback}
            </span>
          )}

          <span className="text-secondary font-body-sm text-body-sm whitespace-nowrap shrink-0">
            {timeAgo(notification.created_at)}
          </span>
          {!notification.is_read && (
            <span className="w-2 h-2 rounded-full bg-primary shrink-0" aria-label="Unread" />
          )}
        </div>

        {/* Sighting details — single compact row */}
        {notification.sighting && (
          <div className="flex items-center gap-sm px-sm py-xs bg-surface-container-low rounded-xl">
            {notification.sighting.location_description ? (
              <span className="flex items-center gap-xs text-on-surface font-body-sm text-body-sm min-w-0">
                <span className="material-symbols-outlined text-[13px] text-primary shrink-0">location_on</span>
                <span className="truncate">{notification.sighting.location_description}</span>
              </span>
            ) : (
              <span className="text-secondary font-body-sm text-body-sm">No location</span>
            )}
            <span
              className={`shrink-0 ml-auto px-xs py-[2px] rounded-full text-[11px] font-label-sm ${
                CONFIDENCE_COLOR[notification.sighting.confidence] ?? 'bg-surface-container text-secondary'
              }`}
            >
              {CONFIDENCE_SHORT[notification.sighting.confidence] ?? notification.sighting.confidence}
            </span>
          </div>
        )}

        {/* Actions */}
        {isSightingPending ? (
          <div className="grid grid-cols-2 gap-sm pt-sm border-t border-surface-container">
            <button
              type="button"
              disabled={!!verifyingId}
              onClick={() =>
                onVerify(notification.report!.id!, notification.sighting!.id, 'USEFUL', notification.id)
              }
              className="flex items-center justify-center gap-xs py-sm rounded-xl bg-[#2D8C3C]/10 text-[#2D8C3C] font-label-md text-label-md hover:bg-[#2D8C3C]/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {isVerifying ? (
                <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
              ) : (
                <span className="material-symbols-outlined text-[16px]">thumb_up</span>
              )}
              Approve
            </button>
            <button
              type="button"
              disabled={!!verifyingId}
              onClick={() =>
                onVerify(notification.report!.id!, notification.sighting!.id, 'FALSE', notification.id)
              }
              className="flex items-center justify-center gap-xs py-sm rounded-xl bg-error-container text-on-error-container font-label-md text-label-md hover:opacity-80 active:scale-95 transition-all disabled:opacity-50"
            >
              {isVerifying ? (
                <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
              ) : (
                <span className="material-symbols-outlined text-[16px]">thumb_down</span>
              )}
              False
            </button>
            <Link
              to={notification.action_url || `/my-reports/${notification.report?.id ?? ''}`}
              onClick={handleClick}
              className="col-span-2 text-center text-primary font-label-sm text-label-sm py-xs hover:underline"
            >
              View full report
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between pt-sm border-t border-surface-container">
            {notification.report ? (
              <Link
                to={notification.action_url || `/my-reports/${notification.report.id ?? ''}`}
                onClick={handleClick}
                className="flex items-center gap-xs text-primary font-label-md text-label-md hover:underline"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                View report
              </Link>
            ) : (
              <span />
            )}
            {!notification.is_read && (
              <button
                type="button"
                onClick={handleClick}
                aria-label="Mark as read"
                className="w-8 h-8 rounded-full flex items-center justify-center text-secondary hover:bg-surface-container hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">done</span>
              </button>
            )}
          </div>
        )}
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
