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
import { generatePublicSummary, type AISuggestionResponse } from '../services/aiApi';

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
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [aiSummarySuggestion, setAiSummarySuggestion] = useState<AISuggestionResponse | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
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
      publicSummary: '',
    },
  });

  const handleGeneratePublicSummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const res = await generatePublicSummary({
        cat_name: state?.step1?.catName,
        coat_color: state?.step1?.coatColor,
        last_seen_landmark: state?.step2?.landmark,
        description: state?.step1?.description,
      });
      setAiSummarySuggestion(res);
      dispatch(addNotification('Gemma AI public summary ready.', 'success'));
    } catch {
      dispatch(addNotification('Could not generate public summary at this time.', 'error'));
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const onSubmit = async (step3: ReportStep3Data) => {
    setIsSubmitting(true);
    try {
      const report = await createReport({ step1: state!.step1!, step2: state!.step2!, step3, photo: state?.photo });
      setIsSubmitted(true);
      dispatch(
        addNotification(
          `Missing report for ${state?.step1?.catName ?? 'your cat'} has been posted. The community is now on alert!`,
          'success',
        ),
      );
      await new Promise((r) => setTimeout(r, 800));
      navigate(`/my-reports/${report.id}`);
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

                {/* Public broadcast summary with Gemma AI */}
                <div className="space-y-xs pt-base border-t border-surface-container">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="publicSummary"
                      className="block font-label-md text-label-md text-on-surface"
                    >
                      Public Broadcast Summary <span className="text-secondary font-normal">(Optional)</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGeneratePublicSummary}
                      disabled={isGeneratingSummary}
                      className="text-xs font-bold text-primary hover:text-primary-container flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {isGeneratingSummary ? 'progress_activity' : 'auto_awesome'}
                      </span>
                      {isGeneratingSummary ? 'Generating...' : 'Generate with Gemma AI'}
                    </button>
                  </div>
                  <p className="font-label-sm text-label-sm text-secondary">
                    A concise, privacy-safe 1-2 sentence alert shown on public maps and feed cards without private owner details.
                  </p>
                  <textarea
                    id="publicSummary"
                    rows={2}
                    maxLength={240}
                    placeholder="e.g. Missing friendly orange tabby near Central Park. Please check sheds and garages."
                    aria-invalid={Boolean(errors.publicSummary)}
                    aria-describedby={errors.publicSummary ? 'publicSummary-error' : undefined}
                    className="w-full bg-surface-container-low border-none rounded-xl p-sm font-body-md text-body-md focus:ring-2 focus:ring-on-background transition-all outline-none resize-none"
                    {...register('publicSummary')}
                  />
                  {errors.publicSummary && (
                    <p id="publicSummary-error" role="alert" className="text-error text-label-sm">
                      {errors.publicSummary.message}
                    </p>
                  )}

                  {aiSummarySuggestion && (
                    <div className="mt-2 p-md bg-primary-container/10 border border-primary-container/30 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                          <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                          <span>Gemma AI Suggestion</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-secondary">Review before applying</span>
                      </div>
                      <p className="text-body-sm font-body-sm text-on-surface bg-white p-sm rounded-lg border border-surface-container">
                        {aiSummarySuggestion.suggestion}
                      </p>
                      <p className="text-[11px] text-secondary italic">
                        {aiSummarySuggestion.privacy_notice ||
                          'Private contact details are excluded before AI processing. Review before saving.'}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setValue('publicSummary', aiSummarySuggestion.suggestion, {
                              shouldValidate: true,
                              shouldDirty: true,
                            });
                            setAiSummarySuggestion(null);
                          }}
                          className="px-3 py-1 bg-primary text-white rounded-lg text-xs font-bold hover:brightness-105 transition-all cursor-pointer"
                        >
                          Apply Suggestion
                        </button>
                        <button
                          type="button"
                          onClick={() => setAiSummarySuggestion(null)}
                          className="px-3 py-1 bg-surface-container text-secondary rounded-lg text-xs font-bold hover:bg-surface-container-high transition-all cursor-pointer"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
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
                        'url("https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=800&h=600&fit=crop")',
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
