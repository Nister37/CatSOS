import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { addNotification, dismissNotification } from '../features/notifications/notificationsSlice';
import type { NotificationTone } from '../features/notifications/notificationsSlice';

type Tab = 'notifications' | 'settings';

const TONE_STYLES: Record<
  NotificationTone,
  { icon: string; wrapperCls: string; iconCls: string }
> = {
  info: {
    icon: 'info',
    wrapperCls: 'bg-blue-50 border-blue-200',
    iconCls: 'text-blue-500',
  },
  success: {
    icon: 'check_circle',
    wrapperCls: 'bg-green-50 border-green-200',
    iconCls: 'text-green-600',
  },
  warning: {
    icon: 'warning',
    wrapperCls: 'bg-amber-50 border-amber-200',
    iconCls: 'text-amber-600',
  },
  error: {
    icon: 'error',
    wrapperCls: 'bg-red-50 border-red-200',
    iconCls: 'text-error',
  },
};

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Enter a valid email address'),
});
type ProfileFormData = z.infer<typeof profileSchema>;

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('notifications');
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const notifications = useAppSelector((state) => state.notifications.items);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email ?? '',
    },
  });

  const onSave = async () => {
    await new Promise((r) => setTimeout(r, 500));
    dispatch(addNotification('Profile editing will be available once the backend endpoint is ready.', 'info'));
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'notifications', label: 'Notifications', icon: 'notifications' },
    { id: 'settings', label: 'Settings', icon: 'manage_accounts' },
  ];

  const displayName = user
    ? user.firstName
      ? `${user.firstName} ${user.lastName}`.trim()
      : user.email
    : 'Account';

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow pt-28 pb-xl px-margin-mobile">
        {/* Background decorations */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[30%] h-[30%] rounded-full bg-on-background/5 blur-[100px]" />
        </div>

        <div className="w-full max-w-[640px] mx-auto">
          {/* Profile header */}
          <div className="flex items-center gap-md mb-lg">
            <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-primary text-[28px]">account_circle</span>
            </div>
            <div className="min-w-0">
              <h1 className="font-headline-md text-headline-md text-on-background truncate">
                {displayName}
              </h1>
              {user?.firstName && (
                <p className="font-label-md text-label-md text-secondary truncate">{user.email}</p>
              )}
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-xs border-b border-surface-container mb-lg">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-xs pb-sm px-sm font-label-md text-label-md transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? 'text-primary border-primary'
                    : 'text-secondary border-transparent hover:text-on-background hover:border-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                {tab.label}
                {tab.id === 'notifications' && notifications.length > 0 && (
                  <span className="flex items-center justify-center min-w-[20px] h-5 px-xs rounded-full bg-primary text-on-primary text-[11px] font-bold leading-none">
                    {notifications.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Notifications tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-sm">
              {notifications.length === 0 ? (
                <div className="bg-surface-container-lowest rounded-xl border border-surface-container p-xl flex flex-col items-center text-center gap-md">
                  <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
                    <span className="material-symbols-outlined text-[32px] text-secondary/50">
                      notifications_none
                    </span>
                  </div>
                  <div>
                    <p className="font-headline-md text-headline-md text-on-background">
                      All clear
                    </p>
                    <p className="font-body-md text-body-md text-secondary mt-xs">
                      You have no notifications right now.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-sm">
                    <p className="font-label-md text-label-md text-secondary">
                      {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        notifications.forEach((n) => dispatch(dismissNotification(n.id)))
                      }
                      className="font-label-md text-label-md text-primary hover:underline"
                    >
                      Dismiss all
                    </button>
                  </div>
                  {notifications.map((notification) => {
                    const style = TONE_STYLES[notification.tone];
                    return (
                      <div
                        key={notification.id}
                        className={`flex items-start gap-md p-md rounded-xl border ${style.wrapperCls} transition-all`}
                      >
                        <span
                          className={`material-symbols-outlined text-[20px] mt-[2px] flex-shrink-0 ${style.iconCls}`}
                        >
                          {style.icon}
                        </span>
                        <p className="flex-grow font-body-md text-body-md text-on-background">
                          {notification.message}
                        </p>
                        <button
                          type="button"
                          aria-label="Dismiss notification"
                          onClick={() => dispatch(dismissNotification(notification.id))}
                          className="flex-shrink-0 text-secondary hover:text-on-background transition-colors p-xs rounded-lg hover:bg-black/5"
                        >
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* Settings tab */}
          {activeTab === 'settings' && (
            <div className="space-y-md">
              {/* Profile section */}
              <div className="bg-surface-container-lowest rounded-xl border border-surface-container shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-lg">
                <div className="flex items-center gap-xs mb-lg">
                  <span className="material-symbols-outlined text-primary text-[20px]">person</span>
                  <h2 className="font-headline-md text-headline-md text-on-background">Profile</h2>
                </div>

                <form onSubmit={handleSubmit(onSave)} noValidate className="space-y-md">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                    <div className="flex flex-col gap-xs">
                      <label
                        className="font-label-md text-label-md text-on-surface-variant"
                        htmlFor="firstName"
                      >
                        First Name
                      </label>
                      <input
                        id="firstName"
                        type="text"
                        placeholder="Jane"
                        aria-invalid={Boolean(errors.firstName)}
                        aria-describedby={errors.firstName ? 'firstName-error' : undefined}
                        className="bg-surface-container-low border-2 border-transparent rounded-lg px-md py-sm font-body-md text-body-md transition-all duration-200 focus:outline-none focus:border-on-background focus:bg-white"
                        {...register('firstName')}
                      />
                      {errors.firstName && (
                        <p id="firstName-error" role="alert" className="text-error text-label-sm">
                          {errors.firstName.message}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-xs">
                      <label
                        className="font-label-md text-label-md text-on-surface-variant"
                        htmlFor="lastName"
                      >
                        Last Name
                      </label>
                      <input
                        id="lastName"
                        type="text"
                        placeholder="Doe"
                        aria-invalid={Boolean(errors.lastName)}
                        aria-describedby={errors.lastName ? 'lastName-error' : undefined}
                        className="bg-surface-container-low border-2 border-transparent rounded-lg px-md py-sm font-body-md text-body-md transition-all duration-200 focus:outline-none focus:border-on-background focus:bg-white"
                        {...register('lastName')}
                      />
                      {errors.lastName && (
                        <p id="lastName-error" role="alert" className="text-error text-label-sm">
                          {errors.lastName.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-xs">
                    <label
                      className="font-label-md text-label-md text-on-surface-variant"
                      htmlFor="email"
                    >
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? 'email-error' : undefined}
                      className="bg-surface-container-low border-2 border-transparent rounded-lg px-md py-sm font-body-md text-body-md transition-all duration-200 focus:outline-none focus:border-on-background focus:bg-white"
                      {...register('email')}
                    />
                    {errors.email && (
                      <p id="email-error" role="alert" className="text-error text-label-sm">
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end pt-xs">
                    <button
                      type="submit"
                      disabled={isSubmitting || !isDirty}
                      className="bg-primary text-on-primary font-label-md text-label-md px-lg py-sm rounded-lg hover:brightness-110 active:scale-[0.98] transition-all shadow-sm flex items-center gap-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        'Saving…'
                      ) : (
                        <>
                          Save Changes
                          <span className="material-symbols-outlined text-[16px]">check</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Security section */}
              <div className="bg-surface-container-lowest rounded-xl border border-surface-container shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-lg">
                <div className="flex items-center gap-xs mb-md">
                  <span className="material-symbols-outlined text-primary text-[20px]">shield</span>
                  <h2 className="font-headline-md text-headline-md text-on-background">Security</h2>
                </div>
                <p className="font-body-md text-body-md text-secondary mb-md">
                  Manage your password and account security preferences.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    dispatch(addNotification('Password change will be available soon.', 'info'))
                  }
                  className="flex items-center gap-xs border-2 border-surface-container-high text-on-background px-md py-sm rounded-lg font-label-md text-label-md hover:border-on-background/30 hover:bg-surface-container-low transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">lock</span>
                  Change Password
                </button>
              </div>

              {/* Danger zone */}
              <div className="bg-surface-container-lowest rounded-xl border border-error/20 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-lg">
                <div className="flex items-center gap-xs mb-md">
                  <span className="material-symbols-outlined text-error text-[20px]">warning</span>
                  <h2 className="font-headline-md text-headline-md text-on-background">Danger Zone</h2>
                </div>
                <p className="font-body-md text-body-md text-secondary mb-md">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    dispatch(addNotification('Account deletion will be available soon.', 'warning'))
                  }
                  className="flex items-center gap-xs border-2 border-error/30 text-error px-md py-sm rounded-lg font-label-md text-label-md hover:bg-error/5 hover:border-error/50 transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                  Delete Account
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
