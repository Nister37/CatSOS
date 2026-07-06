import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';

interface MockCat {
  id: string;
  name: string;
  imageUrl: string | null;
}

const MOCK_CATS: MockCat[] = [
  {
    id: 'oliver',
    name: 'Oliver',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDdvBKs7fX3EuFADHmtNzpDvY-pNaJkxG18rcdbnmsHqB9ftZwEwuEzpdEUcWlhVqvbmlfnkqcORJuuslJc_k10Cnnd-ffPyBVyQ7iNTzsOMDoV_mxa560fysOsWbs2oRaFlnR01V99YG9cLWiFUO3jI2JMnNCMMqSKBA5I895wmaWJ0C2dh_k-pDxfVI_z06kFP18ij5L-a2gVOl7CdfGxZDR5iQb4e3ifIsgaSCWSM5geiJk7BAlZrg',
  },
  {
    id: 'luna',
    name: 'Luna',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBAzoeIF-S4ZHtkYIKwRPs2n_s-llMgvuXcZxQougEJibi1biUDDBitBAYxVN0m04Xxmj1ujXmCIqZr_JCeaqPCIAXitklO4C-oqI3PSTadLW8EMvp9R04x6Sod1rIRssXiYQ0bNWX_5PZcjVJMgS16E5UOKCNZ626RQ6_MpI_xtQMlyOdwMblYsZmh367oQXkULlkqQMjrH1HTuztE2B2HdGKDIp766i22apU9KjHo_2gZ0qCG1ltj1w',
  },
  {
    id: 'mochi',
    name: 'Mochi',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCT-7wpxDA228yLoTJ8cYyp-pFUAk9fVdqotk9W4cn9xdPuyRWc0nWwWChBULT--lQL4qQzomDPaEGlEN0_iGukkknJvFbGBFzBD7_9JCNmJO9-XDgFQ1LPpU7Wt359e3n8xVSfZ947AUM_jaJQ_VOGtnTieL7vpJK7_0ot5yRdWy_dA5bILX9zCxaXth65-6lYUPQp4xDBrdH2_-BJ0azbZsWf2QDwHJi39ZMAc-cuMhCBI-auA--FAg',
  },
  {
    id: 'unknown',
    name: 'Unknown Cat',
    imageUrl: null,
  },
];

export function ReportSightingPage() {
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function resetUpload(e: React.MouseEvent) {
    e.stopPropagation();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 1500);
  }

  function resetForm() {
    setSelectedCat(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setSubmitted(false);
  }

  return (
    <div className="bg-background text-on-background font-body-md scroll-smooth min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow pt-32 pb-xl px-margin-mobile md:px-xl max-w-container-max mx-auto">
        {submitted ? (
          /* Success state */
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-lg">
            <div className="w-20 h-20 rounded-full bg-[#2D8C3C]/10 flex items-center justify-center">
              <span
                className="material-symbols-outlined text-[48px] text-[#2D8C3C]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
            </div>
            <div>
              <h1 className="font-headline-lg text-headline-lg text-on-background mb-xs">
                Sighting Reported!
              </h1>
              <p className="font-body-lg text-body-lg text-secondary max-w-md mx-auto">
                The community has been notified. Every report increases the chances of a happy
                reunion.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-md">
              <Link
                to="/map"
                className="bg-primary text-on-primary px-xl py-md rounded-xl font-label-md hover:scale-95 active:scale-95 transition-transform text-center"
              >
                Back to Sightings Map
              </Link>
              <button
                type="button"
                onClick={resetForm}
                className="border-2 border-on-background text-on-background px-xl py-md rounded-xl font-label-md hover:bg-on-background hover:text-on-primary transition-colors"
              >
                Report Another Sighting
              </button>
            </div>
          </div>
        ) : (
          <>
            <header className="mb-lg">
              <h1 className="font-headline-lg text-headline-lg mb-xs">Report a Sighting</h1>
              <p className="text-secondary font-body-lg">
                Help us bring a cat home by sharing details of your spot.
              </p>
            </header>

            <form
              id="sightingForm"
              className="grid grid-cols-1 lg:grid-cols-12 gap-lg"
              onSubmit={handleSubmit}
            >
              {/* Left column */}
              <div className="lg:col-span-7 space-y-lg">
                {/* Cat selection */}
                <section>
                  <div className="flex justify-between items-end mb-md">
                    <h2 className="font-headline-md text-headline-md">Identify the Cat</h2>
                    <span className="text-label-sm text-secondary">Recently Reported Nearby</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-md">
                    {MOCK_CATS.map((cat) => {
                      const isSelected = selectedCat === cat.id;
                      return (
                        <div
                          key={cat.id}
                          role="button"
                          tabIndex={0}
                          aria-pressed={isSelected}
                          onClick={() => setSelectedCat(cat.id)}
                          onKeyDown={(e) => e.key === 'Enter' && setSelectedCat(cat.id)}
                          className="group cursor-pointer relative"
                        >
                          <div
                            className={`aspect-square rounded-xl overflow-hidden mb-xs bg-surface-container transition-all group-hover:shadow-md border-2 ${
                              isSelected
                                ? 'border-primary-container'
                                : 'border-transparent'
                            } ${cat.imageUrl === null ? 'flex flex-col items-center justify-center border-dashed border-outline-variant bg-surface-container-high' : ''}`}
                            style={
                              isSelected
                                ? { boxShadow: '0 0 0 4px #ff5a5f' }
                                : undefined
                            }
                          >
                            {cat.imageUrl ? (
                              <img
                                src={cat.imageUrl}
                                alt={cat.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-[48px] text-secondary mb-1">
                                  question_mark
                                </span>
                                <span className="text-label-sm text-secondary">Not Listed</span>
                              </>
                            )}
                          </div>
                          <p className="font-label-md text-center">{cat.name}</p>
                          {isSelected && (
                            <div className="absolute top-2 right-2 bg-primary-container text-white rounded-full p-1 shadow-sm">
                              <span className="material-symbols-outlined text-[18px]">check</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Details textarea */}
                <section>
                  <label
                    htmlFor="details"
                    className="block font-headline-md text-headline-md mb-md"
                  >
                    Additional Details
                  </label>
                  <textarea
                    id="details"
                    rows={5}
                    placeholder="Where did you see them? Which direction were they heading? Did they look healthy?"
                    className="w-full p-md bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-on-background transition-all placeholder:text-secondary font-body-md resize-none"
                  />
                </section>
              </div>

              {/* Right column */}
              <div className="lg:col-span-5 space-y-lg">
                {/* Photo upload */}
                <section>
                  <h2 className="font-headline-md text-headline-md mb-md">Sighting Photo</h2>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Upload a photo of the sighting"
                    onClick={() => !previewUrl && fileInputRef.current?.click()}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && !previewUrl && fileInputRef.current?.click()
                    }
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files[0];
                      if (file) handleFile(file);
                    }}
                    className={`relative border-2 border-dashed rounded-2xl p-xl flex flex-col items-center justify-center min-h-[300px] transition-colors ${
                      isDragging
                        ? 'bg-surface-variant border-primary-container'
                        : 'border-outline-variant bg-surface-container-lowest hover:bg-surface cursor-pointer'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile(file);
                      }}
                    />

                    {previewUrl ? (
                      <div className="absolute inset-0 p-xs">
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="w-full h-full object-cover rounded-xl shadow-inner"
                        />
                        <button
                          type="button"
                          onClick={resetUpload}
                          aria-label="Remove photo"
                          className="absolute top-4 right-4 bg-on-background/80 text-white rounded-full p-2 hover:bg-on-background transition-colors"
                        >
                          <span className="material-symbols-outlined">close</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-center pointer-events-none">
                        <div className="bg-primary-container text-on-primary w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-md shadow-lg shadow-primary-container/20">
                          <span
                            className="material-symbols-outlined text-[32px]"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            add_a_photo
                          </span>
                        </div>
                        <p className="font-headline-md mb-xs">Tap to upload photo</p>
                        <p className="text-label-sm text-secondary">
                          Take a clear photo if possible
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Submit */}
                <div className="flex flex-col gap-sm pt-md">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-primary-container text-on-primary py-md rounded-xl font-headline-md hover:shadow-lg hover:shadow-primary-container/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-sm"
                  >
                    {submitting ? (
                      <>
                        <span className="material-symbols-outlined animate-spin">
                          progress_activity
                        </span>
                        Sending...
                      </>
                    ) : (
                      'Submit Sighting'
                    )}
                  </button>
                </div>

                {/* Safety guidance */}
                <div className="bg-surface-container p-md rounded-xl border border-outline-variant">
                  <div className="flex gap-md">
                    <span
                      className="material-symbols-outlined text-primary shrink-0"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      info
                    </span>
                    <div>
                      <p className="font-label-md mb-1">Safety First</p>
                      <p className="text-label-sm text-on-surface-variant">
                        Do not attempt to chase or corner a stray cat. Maintain distance and report
                        the location immediately.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
