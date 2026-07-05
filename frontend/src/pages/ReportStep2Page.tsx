import L from 'leaflet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';

import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { reportStep2Schema } from '../schemas/reportStep2Schema';
import type { ReportStep2Data } from '../schemas/reportStep2Schema';
import type { ReportStep1Data } from '../schemas/reportStep1Schema';

const DEFAULT_CENTER: [number, number] = [51.505, -0.09];
const DEFAULT_ZOOM = 12;
const PIN_ZOOM = 15;

// Placed inside MapContainer — handles map click to drop the pin
function LocationPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Placed inside MapContainer — flies to user position exactly once on mount
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

export function ReportStep2Page() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const step1Data = (routerLocation.state as { step1?: ReportStep1Data } | null)?.step1;

  const mapRef = useRef<L.Map | null>(null);
  const [pinPosition, setPinPosition] = useState<[number, number] | null>(null);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ReportStep2Data>({
    resolver: zodResolver(reportStep2Schema),
    defaultValues: { address: '', landmark: '' },
  });

  // Request geolocation once on mount to centre the map
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPosition([pos.coords.latitude, pos.coords.longitude]);
      },
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

  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      const pos: [number, number] = [lat, lng];
      setPinPosition(pos);
      setIsFetchingAddress(true);
      const addr = await reverseGeocode(lat, lng);
      if (addr) setValue('address', addr, { shouldValidate: true });
      setIsFetchingAddress(false);
    },
    [setValue],
  );

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

  const onSubmit = (data: ReportStep2Data) => {
    navigate('/report-missing/contact', {
      state: {
        step1: step1Data,
        step2: { ...data, lat: pinPosition?.[0], lng: pinPosition?.[1] },
      },
    });
  };

  return (
    <div className="bg-background text-on-background font-body-md scroll-smooth min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow pt-28 pb-xl px-margin-mobile">
        <div className="max-w-container-max mx-auto">
          {/* Progress indicator */}
          <div className="mb-lg max-w-3xl mx-auto">
            <div className="flex justify-between items-center mb-base">
              <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest">
                Step 2 of 3
              </span>
              <span className="font-label-sm text-label-sm text-secondary">66% Complete</span>
            </div>
            <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-primary-container h-full transition-all duration-700 ease-out"
                style={{ width: '66%' }}
                role="progressbar"
                aria-valuenow={2}
                aria-valuemin={1}
                aria-valuemax={3}
                aria-label="Step 2 of 3"
              />
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-xl">
            <h1 className="font-headline-lg text-headline-lg mb-base text-on-background">
              Where was your cat last seen?
            </h1>
            <p className="font-body-lg text-body-lg text-secondary max-w-2xl mx-auto">
              Pinpoint the location on the map to help local community members keep an eye out in
              the right area.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* Map + sidebar grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
              {/* Map column */}
              <div className="lg:col-span-8 bg-white rounded-xl overflow-hidden relative shadow-sm border border-surface-container">
                <MapContainer
                  ref={mapRef}
                  center={DEFAULT_CENTER}
                  zoom={DEFAULT_ZOOM}
                  scrollWheelZoom
                  zoomControl={false}
                  style={{ height: 500, cursor: 'crosshair' }}
                  aria-label="Map – click to mark last seen location"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <LocationPicker onPick={handleMapClick} />
                  <FlyToUserOnce target={userPosition} />
                  {pinPosition && <Marker position={pinPosition} icon={pinIcon} />}
                </MapContainer>

                {/* Zoom / locate controls – floated over the map */}
                <div className="absolute top-md right-md z-[400] flex flex-col gap-base">
                  <button
                    type="button"
                    aria-label="Zoom in"
                    onClick={() => mapRef.current?.zoomIn()}
                    className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-md hover:bg-surface-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-on-surface">add</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Zoom out"
                    onClick={() => mapRef.current?.zoomOut()}
                    className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-md hover:bg-surface-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-on-surface">remove</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Centre on my location"
                    onClick={handleLocateMe}
                    className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-md hover:bg-surface-container transition-colors"
                  >
                    <span
                      className="material-symbols-outlined text-primary-container"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      my_location
                    </span>
                  </button>
                </div>

                {/* Tap instruction pill */}
                <div className="absolute bottom-md left-1/2 -translate-x-1/2 pointer-events-none z-[400]">
                  <div className="bg-on-background bg-opacity-90 text-white px-md py-base rounded-full text-label-sm font-label-sm flex items-center gap-xs whitespace-nowrap">
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                      touch_app
                    </span>
                    Tap on the map to place the pin
                  </div>
                </div>
              </div>

              {/* Sidebar column */}
              <div className="lg:col-span-4 flex flex-col gap-gutter">
                {/* Address card */}
                <div className="bg-white p-lg rounded-xl shadow-sm border border-surface-container flex flex-col gap-md">
                  <div className="flex items-center gap-xs text-primary-container">
                    <span
                      className="material-symbols-outlined"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      location_on
                    </span>
                    <span className="font-label-md text-label-md">Incident Location</span>
                  </div>

                  <div className="space-y-base">
                    <label
                      htmlFor="address"
                      className="block font-label-sm text-label-sm text-secondary uppercase"
                    >
                      Street Address
                    </label>
                    <input
                      id="address"
                      type="text"
                      placeholder={
                        isFetchingAddress ? 'Fetching address…' : 'Start typing or click the map…'
                      }
                      aria-invalid={Boolean(errors.address)}
                      aria-describedby={errors.address ? 'address-error' : undefined}
                      className="w-full bg-surface-container border-none rounded-lg p-md focus:ring-2 focus:ring-on-background transition-all font-body-md text-body-md"
                      {...register('address')}
                    />
                    {errors.address && (
                      <p id="address-error" role="alert" className="text-error text-label-sm">
                        {errors.address.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-base">
                    <label
                      htmlFor="landmark"
                      className="block font-label-sm text-label-sm text-secondary uppercase"
                    >
                      Area / Landmark{' '}
                      <span className="normal-case text-secondary opacity-60">(Optional)</span>
                    </label>
                    <input
                      id="landmark"
                      type="text"
                      placeholder="e.g. Near the park"
                      className="w-full bg-surface-container border-none rounded-lg p-md focus:ring-2 focus:ring-on-background transition-all font-body-md text-body-md"
                      {...register('landmark')}
                    />
                  </div>

                  <div className="pt-base border-t border-surface-container">
                    <p className="font-label-sm text-label-sm text-secondary leading-relaxed">
                      Accurate location data increases recovery chances by up to 80% by notifying
                      the right neighbors.
                    </p>
                  </div>
                </div>

                {/* Navigation actions */}
                <div className="flex flex-col gap-base">
                  <button
                    type="submit"
                    className="w-full bg-primary-container text-white py-lg rounded-xl font-headline-md text-headline-md flex items-center justify-center gap-base active:scale-[0.98] transition-transform shadow-lg"
                  >
                    Next: Contact Details
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                  <Link
                    to="/report-missing"
                    state={routerLocation.state}
                    className="w-full block text-center border-2 border-surface-container text-on-surface py-md rounded-xl font-label-md text-label-md hover:bg-surface-container transition-colors"
                  >
                    Back to Cat Details
                  </Link>
                </div>
              </div>
            </div>

            {/* Contextual bento cards */}
            <div className="mt-xl grid grid-cols-1 md:grid-cols-3 gap-gutter">
              <div className="bg-white p-md rounded-xl shadow-sm border border-surface-container border-l-4 border-l-primary-container flex items-start gap-md">
                <div className="bg-primary-container/10 p-sm rounded-lg text-primary-container flex-shrink-0">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    campaign
                  </span>
                </div>
                <div>
                  <p className="font-label-md text-label-md">Active Alerts</p>
                  <p className="font-body-md text-body-md text-secondary">
                    3 neighbors recently reported sightings nearby.
                  </p>
                </div>
              </div>

              <div className="bg-white p-md rounded-xl shadow-sm border border-surface-container border-l-4 border-l-on-background flex items-start gap-md">
                <div className="bg-on-background/5 p-sm rounded-lg text-on-background flex-shrink-0">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    groups
                  </span>
                </div>
                <div>
                  <p className="font-label-md text-label-md">Local Network</p>
                  <p className="font-body-md text-body-md text-secondary">
                    420 CatSOS users are active in this radius.
                  </p>
                </div>
              </div>

              <div className="bg-white p-md rounded-xl shadow-sm border border-surface-container border-l-4 border-l-secondary flex items-start gap-md">
                <div className="bg-secondary/10 p-sm rounded-lg text-secondary flex-shrink-0">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    shield
                  </span>
                </div>
                <div>
                  <p className="font-label-md text-label-md">Privacy First</p>
                  <p className="font-body-md text-body-md text-secondary">
                    Your exact house number is never public.
                  </p>
                </div>
              </div>
            </div>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
