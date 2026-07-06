import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { reportStep1Schema, type ReportStep1Data } from '../schemas/reportStep1Schema';

export function ReportStep1Page() {
  const navigate = useNavigate();
  const [photo, setPhoto] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ReportStep1Data>({
    resolver: zodResolver(reportStep1Schema),
    defaultValues: { hasMicrochip: 'no' },
  });

  const hasMicrochip = watch('hasMicrochip');

  const onSubmit = (data: ReportStep1Data) => {
    navigate('/report-missing/location', { state: { step1: data, photo } });
  };

  return (
    <div className="bg-background text-on-background font-body-md scroll-smooth min-h-screen flex flex-col">
      <Navbar />

      {/* Sticky progress bar sits just below the fixed navbar (top-20) */}
      <div className="w-full bg-surface-container h-1.5 fixed top-20 z-40">
        <div
          className="bg-primary-container h-full transition-all duration-500 ease-out"
          style={{ width: '33.33%' }}
          role="progressbar"
          aria-valuenow={1}
          aria-valuemin={1}
          aria-valuemax={3}
          aria-label="Step 1 of 3"
        />
      </div>

      <main className="flex-grow pt-28 pb-xl px-margin-mobile">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-xl">
            <p className="text-label-md font-label-md text-primary uppercase tracking-widest mb-xs">
              Step 1 of 3
            </p>
            <h1 className="font-headline-lg text-headline-lg mb-sm text-on-background">
              Basic Information
            </h1>
            <p className="text-secondary font-body-lg max-w-xl mx-auto">
              Tell us about your friend. High-quality details help the community identify them faster.
            </p>
          </div>

          {/* Form card */}
          <form
            id="sos-form-step-1"
            className="bg-surface-container-lowest rounded-2xl shadow-sm border border-surface-container p-md md:p-xl"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <div className="space-y-lg">
              {/* Name + Coat Color */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                <div className="space-y-xs">
                  <label
                    htmlFor="catName"
                    className="block text-label-md font-label-md text-on-background"
                  >
                    Cat's Name
                  </label>
                  <input
                    id="catName"
                    type="text"
                    placeholder="e.g. Luna"
                    aria-invalid={Boolean(errors.catName)}
                    aria-describedby={errors.catName ? 'catName-error' : undefined}
                    className="w-full bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-on-background p-sm transition-all"
                    {...register('catName')}
                  />
                  {errors.catName && (
                    <p id="catName-error" role="alert" className="text-error text-label-sm">
                      {errors.catName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-xs">
                  <label
                    htmlFor="coatColor"
                    className="block text-label-md font-label-md text-on-background"
                  >
                    Coat Color
                  </label>
                  <input
                    id="coatColor"
                    type="text"
                    placeholder="e.g. Orange, Black & White"
                    aria-invalid={Boolean(errors.coatColor)}
                    aria-describedby={errors.coatColor ? 'coatColor-error' : undefined}
                    className="w-full bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-on-background p-sm transition-all"
                    {...register('coatColor')}
                  />
                  {errors.coatColor && (
                    <p id="coatColor-error" role="alert" className="text-error text-label-sm">
                      {errors.coatColor.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Breed (optional) */}
              <div className="space-y-xs">
                <label
                  htmlFor="breed"
                  className="block text-label-md font-label-md text-on-background"
                >
                  Breed{' '}
                  <span className="text-secondary font-normal">(Optional)</span>
                </label>
                <input
                  id="breed"
                  type="text"
                  placeholder="e.g. Domestic Shorthair, Maine Coon"
                  className="w-full bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-on-background p-sm transition-all"
                  {...register('breed')}
                />
              </div>

              {/* Photo upload */}
              <div className="space-y-xs">
                <span className="block text-label-md font-label-md text-on-background">
                  Recent Photo
                </span>
                <label className="relative group cursor-pointer block border-2 border-dashed border-surface-container-highest rounded-2xl p-xl text-center hover:border-primary-container hover:bg-primary-container/5 transition-all">
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    aria-label="Upload a recent photo of your cat"
                    onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                  />
                  <div className="flex flex-col items-center gap-sm pointer-events-none">
                    <span className="material-symbols-outlined text-4xl text-primary-container">
                      add_a_photo
                    </span>
                    {photo ? (
                      <p className="font-headline-md text-primary-container break-all">{photo.name}</p>
                    ) : (
                      <>
                        <p className="font-headline-md text-primary-container">
                          Click or drag photo here
                        </p>
                        <p className="text-label-sm text-secondary">
                          High-quality photos help significantly in identification
                        </p>
                      </>
                    )}
                  </div>
                </label>
              </div>

              {/* Description */}
              <div className="space-y-xs">
                <label
                  htmlFor="description"
                  className="block text-label-md font-label-md text-on-background"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  rows={3}
                  placeholder="Any distinguishing features, personality traits, or other details that help identify your cat…"
                  aria-invalid={Boolean(errors.description)}
                  aria-describedby={errors.description ? 'description-error' : undefined}
                  className="w-full bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-on-background p-sm transition-all resize-none"
                  {...register('description')}
                />
                {errors.description && (
                  <p id="description-error" role="alert" className="text-error text-label-sm">
                    {errors.description.message}
                  </p>
                )}
              </div>

              {/* Microchip toggle + chip number */}
              <div className="pt-base border-t border-surface-container grid grid-cols-1 md:grid-cols-2 gap-md">
                <fieldset className="space-y-xs border-0 p-0 m-0">
                  <legend className="block text-label-md font-label-md text-on-background mb-xs">
                    Has Microchip?
                  </legend>
                  <div className="flex gap-base">
                    {(['yes', 'no'] as const).map((val) => (
                      <label key={val} className="flex-1 cursor-pointer">
                        <input
                          type="radio"
                          value={val}
                          className="hidden peer"
                          {...register('hasMicrochip')}
                        />
                        <div className="text-center p-sm rounded-xl border-2 border-surface-container peer-checked:border-primary-container peer-checked:bg-primary-container/5 transition-all">
                          {val === 'yes' ? 'Yes' : 'No'}
                        </div>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div
                  className={`space-y-xs transition-opacity duration-200 ${
                    hasMicrochip === 'yes' ? 'opacity-100' : 'opacity-50 pointer-events-none'
                  }`}
                >
                  <label
                    htmlFor="chipNumber"
                    className="block text-label-md font-label-md text-on-background"
                  >
                    Chip Number{' '}
                    <span className="text-secondary font-normal">(Optional)</span>
                  </label>
                  <input
                    id="chipNumber"
                    type="text"
                    placeholder="15-digit number"
                    className="w-full bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-on-background p-sm"
                    {...register('chipNumber')}
                  />
                </div>
              </div>

              {/* Next button */}
              <div className="flex justify-end pt-md">
                <button
                  type="submit"
                  className="bg-on-background text-white px-xl py-4 rounded-full font-bold transition-transform active:scale-95 hover:bg-on-tertiary-fixed-variant flex items-center gap-sm"
                >
                  <span>Next: Location Details</span>
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
            </div>
          </form>

          {/* Pro tip */}
          <div className="mt-xl p-md bg-secondary-container/30 rounded-2xl flex gap-md items-start">
            <span className="material-symbols-outlined text-secondary flex-shrink-0">info</span>
            <div>
              <h4 className="font-label-md text-label-md text-on-background">
                Pro-Tip for Searchers
              </h4>
              <p className="text-label-sm text-secondary mt-xs">
                Most indoor cats stay within 3–4 houses of their home. Check garages, bushes, and
                under porches immediately after reporting.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
