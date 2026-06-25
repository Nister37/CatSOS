import { useAppDispatch, useAppSelector } from '../app/hooks';
import { dismissNotification } from '../features/notifications/notificationsSlice';

export function NotificationList() {
  const dispatch = useAppDispatch();
  const notifications = useAppSelector((state) => state.notifications.items);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <section className="notifications" aria-label="Notifications" aria-live="polite">
      {notifications.map((notification) => (
        <div className={`notification notification-${notification.tone}`} key={notification.id}>
          <p>{notification.message}</p>
          <button type="button" onClick={() => dispatch(dismissNotification(notification.id))}>
            Dismiss
          </button>
        </div>
      ))}
    </section>
  );
}
