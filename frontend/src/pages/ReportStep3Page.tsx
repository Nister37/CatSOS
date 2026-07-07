import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAppDispatch } from '../app/hooks';
import { addNotification } from '../features/notifications/notificationsSlice';
import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { reportStep3Schema, type ReportStep3Data } from '../schemas/reportStep3Schema';
import type { ReportStep1Data } from '../schemas/reportStep1Schema';
import type { ReportStep2Data } from '../schemas/reportStep2Schema';
import { createReport } from '../services/reportsApi';

type RouterState = {
  step1?: ReportStep1Data;
  step2?: ReportStep2Data;
  photo?: File;
} | null;

export function ReportStep3Page() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const dispatch = useAppDispatch();
  const state = routerLocation.state as RouterState;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ReportStep3Data>({
    resolver: zodResolver(reportStep3Schema),
    defaultValues: {
      ownerName: '',
      phone: '',
      email: '',
      notifyPush: true,
      notifySms: true,
      notifyEmail: false,
    },
  });

  const onSubmit = async (step3: ReportStep3Data) => {
    setIsSubmitting(true);
    try {
      await createReport({ step1: state!.step1!, step2: state!.step2!, step3, photo: state?.photo });
      setIsSubmitted(true);
      dispatch(
        addNotification(
          `Missing report for ${state?.step1?.catName ?? 'your cat'} has been posted. The community is now on alert!`,
          'success',
        ),
      );
      await new Promise((r) => setTimeout(r, 800));
      navigate('/');
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'detail' in err
          ? String((err as { detail: unknown }).detail)
          : 'Failed to submit report. Please try again.';
      dispatch(addNotification(message, 'error'));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-background text-on-background font-body-md scroll-smooth min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow pt-28 pb-xl px-margin-mobile">
        <div className="max-w-container-max mx-auto grid grid-cols-1 lg:grid-cols-12 gap-lg">

          {/* Left column — progress & context */}
          <div className="lg:col-span-4 space-y-lg">
            <div className="space-y-sm">
              <p className="text-label-md font-label-md text-primary uppercase tracking-widest">
                Step 3 of 3
              </p>
              <h1 className="font-headline-lg text-headline-lg text-on-surface">Final Step</h1>
              <p className="font-body-lg text-body-lg text-secondary">
                We need your contact details so finders can reach you immediately if your cat is
                spotted.
              </p>
            </div>

            {/* Step tracker */}
            <div className="flex flex-col gap-md">
              {[
                { label: state?.step1?.catName ? `Cat: ${state.step1.catName}` : 'Cat Details', done: true },
                { label: state?.step2?.address ? `Location set` : 'Location & Time', done: true },
                { label: 'Contact Information', done: false },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-md">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-label-md text-label-md flex-shrink-0 ${
                      step.done
                        ? 'bg-primary-container text-white'
                        : 'bg-primary-container text-white'
                    }`}
                  >
                    {step.done ? (
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                        check
                      </span>
                    ) : (
                      '3'
                    )}
                  </div>
                  <span
                    className={`font-label-md text-label-md ${
                      step.done ? 'opacity-60' : 'font-bold'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Privacy card */}
            <div className="bg-surface-container-low p-md rounded-xl space-y-xs border border-surface-container-highest">
              <div className="flex items-center gap-xs text-primary">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                  verified_user
                </span>
                <span className="font-label-sm text-label-sm font-bold">Privacy Protection</span>
              </div>
              <p className="font-label-sm text-label-sm text-secondary">
                Your phone number is only shared with verified community members who report a
                sighting. We never share your data for marketing.
              </p>
            </div>
          </div>

          {/* Right column — form */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-2xl shadow-sm border border-surface-container-highest p-md md:p-xl space-y-lg">
              <form
                id="contact-form"
                onSubmit={handleSubmit(onSubmit)}
                noValidate
                className="space-y-lg"
              >
                {/* Name + Phone */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                  <div className="space-y-xs">
                    <label
                      htmlFor="ownerName"
                      className="block font-label-md text-label-md text-on-surface"
                    >
                      Full Name
                    </label>
                    <div className="relative">
                      <input
                        id="ownerName"
                        type="text"
                        placeholder="Enter your name"
                        aria-invalid={Boolean(errors.ownerName)}
                        aria-describedby={errors.ownerName ? 'ownerName-error' : undefined}
                        className="w-full bg-surface-container-low border-none rounded-xl py-4 px-md font-body-md text-body-md focus:ring-2 focus:ring-on-background transition-all outline-none peer"
                        {...register('ownerName')}
                      />
                      <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-secondary opacity-50 peer-focus:opacity-100 peer-focus:text-primary-container transition-all pointer-events-none">
                        person
                      </span>
                    </div>
                    {errors.ownerName && (
                      <p id="ownerName-error" role="alert" className="text-error text-label-sm">
                        {errors.ownerName.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-xs">
                    <label
                      htmlFor="phone"
                      className="block font-label-md text-label-md text-on-surface"
                    >
                      Phone Number
                    </label>
                    <div className="relative">
                      <input
                        id="phone"
                        type="tel"
                        placeholder="+1 (555) 000-0000"
                        aria-invalid={Boolean(errors.phone)}
                        aria-describedby={errors.phone ? 'phone-error' : undefined}
                        className="w-full bg-surface-container-low border-none rounded-xl py-4 px-md font-body-md text-body-md focus:ring-2 focus:ring-on-background transition-all outline-none peer"
                        {...register('phone')}
                      />
                      <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-secondary opacity-50 peer-focus:opacity-100 peer-focus:text-primary-container transition-all pointer-events-none">
                        call
                      </span>
                    </div>
                    {errors.phone && (
                      <p id="phone-error" role="alert" className="text-error text-label-sm">
                        {errors.phone.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-xs">
                  <label
                    htmlFor="email"
                    className="block font-label-md text-label-md text-on-surface"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      type="email"
                      placeholder="email@example.com"
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? 'email-error' : undefined}
                      className="w-full bg-surface-container-low border-none rounded-xl py-4 px-md font-body-md text-body-md focus:ring-2 focus:ring-on-background transition-all outline-none peer"
                      {...register('email')}
                    />
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-secondary opacity-50 peer-focus:opacity-100 peer-focus:text-primary-container transition-all pointer-events-none">
                      mail
                    </span>
                  </div>
                  {errors.email && (
                    <p id="email-error" role="alert" className="text-error text-label-sm">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {/* Notification preferences */}
                <div className="space-y-md pt-base">
                  <h3 className="font-label-md text-label-md text-on-surface">
                    How should we notify you?
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-sm">
                    {(
                      [
                        { field: 'notifyPush', label: 'Push Alerts' },
                        { field: 'notifySms', label: 'SMS' },
                        { field: 'notifyEmail', label: 'Email' },
                      ] as const
                    ).map(({ field, label }) => (
                      <label
                        key={field}
                        className="flex items-center gap-sm p-md rounded-xl bg-surface-container-low border-2 border-transparent cursor-pointer hover:bg-surface-container transition-colors"
                      >
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded text-primary-container focus:ring-primary-container border-outline"
                          {...register(field)}
                        />
                        <span className="font-label-sm text-label-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Community image banner */}
                <div className="relative h-48 rounded-2xl overflow-hidden">
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                      backgroundImage:
                        'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDKG-Hn0SeqP6u6PPIutzB9uUyBylL_kXxs2lIPy1VpZjuCoGovnJqZpVXcaz42rOVEjW0I8k6A0T2Sxq-VdWS1WKNwGfBqgQ2fu--HF6KpZKilLqsXfG-JMpmnDhBdXMwuJG3xotlDVCS_Vi4OQmtCnBRUihjh4bnLCxCHJKrsvxGxqtqdsZ9fSsiK3FRedOOWHJtZ5UJmBtTXJErX1vS326xlfPM1LuKgQwf6mDMLAqHRbG9_4t_QpA")',
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-on-surface/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <p className="font-label-sm text-label-sm opacity-90">
                      Join 5,000+ local neighbors on alert in your area.
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-md pt-lg border-t border-surface-container">
                  <Link
                    to="/report-missing/location"
                    state={state}
                    className="order-2 md:order-1 font-label-md text-label-md text-secondary py-3 px-md hover:text-on-surface transition-colors"
                  >
                    Back to Location
                  </Link>

                  <button
                    type="submit"
                    disabled={isSubmitting || isSubmitted}
                    className={`order-1 md:order-2 w-full md:w-auto font-headline-md text-[18px] px-xl py-4 rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-sm ${
                      isSubmitted
                        ? 'bg-on-background text-white cursor-default'
                        : 'bg-primary-container text-white hover:brightness-110'
                    } disabled:active:scale-100`}
                  >
                    {isSubmitted ? (
                      <>
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                          check_circle
                        </span>
                        <span>Alert Posted!</span>
                      </>
                    ) : isSubmitting ? (
                      <>
                        <span
                          className="material-symbols-outlined animate-spin"
                          style={{ fontSize: 20 }}
                        >
                          sync
                        </span>
                        <span>Broadcasting Alert…</span>
                      </>
                    ) : (
                      <>
                        <span>Post Missing Report</span>
                        <span className="material-symbols-outlined">send</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
