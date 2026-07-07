import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import L from 'leaflet';
import { MapContainer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { BaseTileLayer } from '../components/BaseTileLayer';

import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { fetchPublicReports, type PublicReport } from '../services/reportsApi';

const DEFAULT_CENTER: [number, number] = [51.505, -0.09];
const DEFAULT_ZOOM = 12;
const PIN_ZOOM = 15;

function LocationPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function FlyToUserOnce({ target }: { target: [number, number] | null }) {
  const map = useMap();
  const hasFlewRef = useRef(false);
  useEffect(() => {
    if (!target || hasFlewRef.current) return;
    hasFlewRef.current = true;
    map.flyTo(target, DEFAULT_ZOOM + 2, { duration: 1.5 });
  }, [target, map]);
  return null;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } },
    );
    const data = await res.json();
    const addr = data.address ?? {};
    const parts = [
      addr.house_number && addr.road ? `${addr.house_number} ${addr.road}` : addr.road,
      addr.suburb ?? addr.neighbourhood ?? addr.quarter,
      addr.city ?? addr.town ?? addr.village,
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : (data.display_name ?? '');
  } catch {
    return '';
  }
}

const UNKNOWN_ID = '__unknown__';

export function ReportSightingPage() {
  const location = useLocation();
  const preSelectedId = (location.state as { preSelectedId?: string } | null)?.preSelectedId ?? null;

  const [cats, setCats] = useState<PublicReport[] | null>(null);
  const [selectedCat, setSelectedCat] = useState<string | null>(preSelectedId);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mapRef = useRef<L.Map | null>(null);
  const [pinPosition, setPinPosition] = useState<[number, number] | null>(null);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const [sightingAddress, setSightingAddress] = useState('');

  useEffect(() => {
    fetchPublicReports(50)
      .then(setCats)
      .catch(() => setCats([]));
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPosition([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { timeout: 8000 },
    );
  }, []);

  const pinIcon = useMemo(
    () =>
      new L.DivIcon({
        className: '',
        html: `<span class="material-symbols-outlined" style="font-size:40px;color:#ff5a5f;font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.4));display:block;line-height:1;">location_on</span>`,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      }),
    [],
  );

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    setPinPosition([lat, lng]);
    setIsFetchingAddress(true);
    const addr = await reverseGeocode(lat, lng);
    if (addr) setSightingAddress(addr);
    setIsFetchingAddress(false);
  }, []);

  const handleLocateMe = () => {
    if (userPosition) {
      mapRef.current?.flyTo(userPosition, PIN_ZOOM, { duration: 1 });
    } else {
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setUserPosition(coords);
          mapRef.current?.flyTo(coords, PIN_ZOOM, { duration: 1 });
        },
        () => {},
      );
    }
  };

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
                    {cats === null
                      ? Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="animate-pulse space-y-xs">
                            <div className="aspect-square rounded-xl bg-surface-container" />
                            <div className="h-4 bg-surface-container rounded-lg mx-auto w-3/4" />
                          </div>
                        ))
                      : [...cats, { public_id: UNKNOWN_ID, cat_name: 'Unknown Cat', main_photo: null } as unknown as PublicReport].map((cat) => {
                          const isSelected = selectedCat === cat.public_id;
                          const imageUrl = cat.public_id === UNKNOWN_ID ? null : cat.main_photo?.url;
                          return (
                            <div
                              key={cat.public_id}
                              role="button"
                              tabIndex={0}
                              aria-pressed={isSelected}
                              onClick={() => setSelectedCat(cat.public_id)}
                              onKeyDown={(e) => e.key === 'Enter' && setSelectedCat(cat.public_id)}
                              className="group cursor-pointer relative"
                            >
                              <div
                                className={`aspect-square rounded-xl overflow-hidden mb-xs bg-surface-container transition-all group-hover:shadow-md border-2 ${
                                  isSelected ? 'border-primary-container' : 'border-transparent'
                                } ${!imageUrl ? 'flex flex-col items-center justify-center border-dashed border-outline-variant bg-surface-container-high' : ''}`}
                                style={isSelected ? { boxShadow: '0 0 0 4px #ff5a5f' } : undefined}
                              >
                                {imageUrl ? (
                                  <img src={imageUrl} alt={cat.cat_name} className="w-full h-full object-cover" />
                                ) : (
                                  <>
                                    <span className="material-symbols-outlined text-[48px] text-secondary mb-1">
                                      {cat.public_id === UNKNOWN_ID ? 'question_mark' : 'pets'}
                                    </span>
                                    {cat.public_id === UNKNOWN_ID && (
                                      <span className="text-label-sm text-secondary">Not Listed</span>
                                    )}
                                  </>
                                )}
                              </div>
                              <p className="font-label-md text-center">{cat.cat_name}</p>
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

                {/* Sighting location */}
                <section>
                  <h2 className="font-headline-md text-headline-md mb-md">Sighting Location</h2>
                  <div className="bg-white rounded-xl border border-surface-container shadow-sm overflow-hidden isolate">
                    <div className="relative" style={{ height: 300 }}>
                      <MapContainer
                        ref={mapRef}
                        center={DEFAULT_CENTER}
                        zoom={DEFAULT_ZOOM}
                        scrollWheelZoom
                        zoomControl={false}
                        style={{ height: '100%', cursor: 'crosshair' }}
                        aria-label="Map – click to mark where you spotted the cat"
                      >
                        <BaseTileLayer />
                        <LocationPicker onPick={handleMapClick} />
                        <FlyToUserOnce target={userPosition} />
                        {pinPosition && <Marker position={pinPosition} icon={pinIcon} />}
                      </MapContainer>

                      {/* Map controls */}
                      <div className="absolute top-sm right-sm z-[400] flex flex-col gap-xs">
                        <button
                          type="button"
                          aria-label="Zoom in"
                          onClick={() => mapRef.current?.zoomIn()}
                          className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-md hover:bg-surface-container transition-colors"
                        >
                          <span className="material-symbols-outlined text-on-surface">add</span>
                        </button>
                        <button
                          type="button"
                          aria-label="Zoom out"
                          onClick={() => mapRef.current?.zoomOut()}
                          className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-md hover:bg-surface-container transition-colors"
                        >
                          <span className="material-symbols-outlined text-on-surface">remove</span>
                        </button>
                        <button
                          type="button"
                          aria-label="Centre on my location"
                          onClick={handleLocateMe}
                          className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-md hover:bg-surface-container transition-colors"
                        >
                          <span className="material-symbols-outlined text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>my_location</span>
                        </button>
                      </div>

                      {/* Tap hint */}
                      <div className="absolute bottom-sm left-1/2 -translate-x-1/2 pointer-events-none z-[400]">
                        <div className="bg-on-background/80 text-white px-md py-xs rounded-full text-label-sm font-label-sm flex items-center gap-xs whitespace-nowrap">
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>touch_app</span>
                          Tap to place the pin
                        </div>
                      </div>
                    </div>

                    <div className="p-md space-y-xs border-t border-surface-container">
                      <label htmlFor="sightingAddress" className="block font-label-sm text-label-sm text-secondary uppercase">
                        Address
                      </label>
                      <input
                        id="sightingAddress"
                        type="text"
                        value={isFetchingAddress ? 'Fetching address…' : sightingAddress}
                        onChange={(e) => setSightingAddress(e.target.value)}
                        placeholder="Click the map or type an address"
                        className="w-full bg-surface-container border-none rounded-lg p-sm focus:ring-2 focus:ring-on-background transition-all font-body-md text-body-md"
                      />
                    </div>
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
