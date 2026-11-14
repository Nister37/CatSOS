import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

import { BaseTileLayer } from './BaseTileLayer';
import { buildGoogleMapsUrl } from '../services/nearbyHelpApi';
import { useTranslation } from '../i18n/useTranslation';

export interface MapPlace {
  id: string | number;
  name?: string | null;
  type?: string;
  address?: string | null;
  isOpen?: boolean;
  phone?: string | null;
  position?: [number, number];
  lat?: number;
  lng?: number;
  distance_km?: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface SheltersMapProps {
  locations: MapPlace[];
  center?: [number, number];
  zoom?: number;
  userLocation?: [number, number];
  selectedPlaceId?: string | number | null;
  onBoundsChange?: (bounds: MapBounds, center: [number, number]) => void;
  onZoomChange?: (zoom: number) => void;
  onSelectPlace?: (place: MapPlace) => void;
  isSearchingArea?: boolean;
  onSearchThisArea?: () => void;
}

const VET_COLOR = '#b52330';
const SHELTER_COLOR = '#2D8C3C';
const CAT_CAFE_COLOR = '#ca8a04';
const OTHER_COLOR = '#f97316';

interface PlaceCluster {
  id: string;
  lat: number;
  lng: number;
  places: MapPlace[];
  bounds: [[number, number], [number, number]];
  isCluster: boolean;
}

/**
 * Projects a (lat, lng) to Web Mercator pixel coordinates at a given zoom level.
 */
function latLngToPixel(lat: number, lng: number, zoom: number): [number, number] {
  const sinY = Math.sin((lat * Math.PI) / 180);
  const clampedSinY = Math.min(Math.max(sinY, -0.9999), 0.9999);
  const scale = 256 * Math.pow(2, zoom);
  const x = scale * (0.5 + lng / 360);
  const y = scale * (0.5 - Math.log((1 + clampedSinY) / (1 - clampedSinY)) / (4 * Math.PI));
  return [x, y];
}

/**
 * Groups nearby places into clusters when zoomed out.
 * Radius in pixels determines grouping density at the current zoom level.
 */
function clusterPlaces(places: MapPlace[], zoom: number, radiusPx = 55): PlaceCluster[] {
  const clusters: PlaceCluster[] = [];
  const assigned = new Set<string | number>();

  // Extract coordinates for each place
  const validPlaces = places
    .map((p, idx) => {
      const lat = p.lat ?? p.position?.[0];
      const lng = p.lng ?? p.position?.[1];
      const id = p.id ?? `${lat}-${lng}-${idx}`;
      return { place: p, lat, lng, id };
    })
    .filter(
      (item): item is { place: MapPlace; lat: number; lng: number; id: string | number } =>
        typeof item.lat === 'number' &&
        !isNaN(item.lat) &&
        typeof item.lng === 'number' &&
        !isNaN(item.lng),
    );

  for (let i = 0; i < validPlaces.length; i++) {
    const item1 = validPlaces[i];
    if (assigned.has(item1.id)) continue;

    const [x1, y1] = latLngToPixel(item1.lat, item1.lng, zoom);
    const clusterPlacesList: MapPlace[] = [item1.place];
    assigned.add(item1.id);

    let minLat = item1.lat;
    let maxLat = item1.lat;
    let minLng = item1.lng;
    let maxLng = item1.lng;

    // Search for neighboring places within radiusPx in screen space
    for (let j = i + 1; j < validPlaces.length; j++) {
      const item2 = validPlaces[j];
      if (assigned.has(item2.id)) continue;

      const [x2, y2] = latLngToPixel(item2.lat, item2.lng, zoom);
      const dist = Math.hypot(x1 - x2, y1 - y2);

      if (dist <= radiusPx) {
        clusterPlacesList.push(item2.place);
        assigned.add(item2.id);
        minLat = Math.min(minLat, item2.lat);
        maxLat = Math.max(maxLat, item2.lat);
        minLng = Math.min(minLng, item2.lng);
        maxLng = Math.max(maxLng, item2.lng);
      }
    }

    const avgLat =
      clusterPlacesList.reduce((sum, p) => sum + (p.lat ?? p.position?.[0] ?? 0), 0) /
      clusterPlacesList.length;
    const avgLng =
      clusterPlacesList.reduce((sum, p) => sum + (p.lng ?? p.position?.[1] ?? 0), 0) /
      clusterPlacesList.length;

    clusters.push({
      id: `cluster-${item1.id}-${clusterPlacesList.length}`,
      lat: avgLat,
      lng: avgLng,
      places: clusterPlacesList,
      bounds: [
        [minLat, minLng],
        [maxLat, maxLng],
      ],
      isCluster: clusterPlacesList.length > 1,
    });
  }

  return clusters;
}

function ChangeView({ center, zoom }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  const prevCenterRef = useRef<[number, number]>(center);
  const prevZoomRef = useRef<number | undefined>(zoom);
  const isInteractingRef = useRef(false);
  const interactionCooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useMapEvents({
    movestart: () => {
      isInteractingRef.current = true;
      if (interactionCooldownRef.current) clearTimeout(interactionCooldownRef.current);
    },
    zoomstart: () => {
      isInteractingRef.current = true;
      if (interactionCooldownRef.current) clearTimeout(interactionCooldownRef.current);
    },
    moveend: () => {
      if (interactionCooldownRef.current) clearTimeout(interactionCooldownRef.current);
      interactionCooldownRef.current = setTimeout(() => {
        isInteractingRef.current = false;
      }, 300);
    },
    zoomend: () => {
      if (interactionCooldownRef.current) clearTimeout(interactionCooldownRef.current);
      interactionCooldownRef.current = setTimeout(() => {
        isInteractingRef.current = false;
      }, 300);
    },
  });

  useEffect(() => {
    return () => {
      if (interactionCooldownRef.current) clearTimeout(interactionCooldownRef.current);
    };
  }, []);

  useEffect(() => {
    if (!map || typeof map.setView !== 'function') return;

    // Check if the props actually changed externally
    const centerChanged =
      Math.abs(prevCenterRef.current[0] - center[0]) > 0.0001 ||
      Math.abs(prevCenterRef.current[1] - center[1]) > 0.0001;
    const zoomChanged = zoom !== undefined && zoom !== prevZoomRef.current;

    prevCenterRef.current = center;
    prevZoomRef.current = zoom;

    // If user is currently dragging or zooming, do not interfere
    if (isInteractingRef.current) return;

    if (centerChanged || zoomChanged) {
      const currentCenter = typeof map.getCenter === 'function' ? map.getCenter() : null;
      const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : 12;

      // When zoom did not change externally, preserve current map zoom rather than reverting
      const targetZoom = zoomChanged && zoom !== undefined ? zoom : currentZoom;

      const isSameCenter =
        currentCenter &&
        Math.abs(currentCenter.lat - center[0]) < 0.0002 &&
        Math.abs(currentCenter.lng - center[1]) < 0.0002;
      const isSameZoom = currentZoom === targetZoom;

      if (!isSameCenter || !isSameZoom) {
        map.setView(center, targetZoom);
      }
    }
  }, [center[0], center[1], zoom, map]);

  return null;
}

function MapEventsListener({
  onBoundsChange,
  onZoomChange,
}: {
  onBoundsChange?: (bounds: MapBounds, center: [number, number]) => void;
  onZoomChange?: (zoom: number) => void;
}) {
  const map = useMapEvents({
    moveend: () => {
      if (!map) return;
      if (typeof map.getZoom === 'function' && onZoomChange) {
        onZoomChange(map.getZoom());
      }
      if (!onBoundsChange || typeof map.getBounds !== 'function') return;
      const b = map.getBounds();
      const c = typeof map.getCenter === 'function' ? map.getCenter() : { lat: 0, lng: 0 };
      if (!b || typeof b.getNorth !== 'function') return;
      onBoundsChange(
        {
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest(),
        },
        [c.lat, c.lng],
      );
    },
    zoomend: () => {
      if (!map || typeof map.getZoom !== 'function') return;
      onZoomChange?.(map.getZoom());
    },
  });
  return null;
}

function createClusterIcon(count: number, hasSelected: boolean) {
  const size = count >= 50 ? 52 : count >= 10 ? 46 : 40;
  const half = Math.round(size / 2);

  return new L.DivIcon({
    className: 'shelter-cluster-icon',
    html: `
      <div
        class="cluster-bubble-marker"
        style="
          display: flex;
          align-items: center;
          justify-content: center;
          width: ${size}px;
          height: ${size}px;
          border-radius: 9999px;
          background: linear-gradient(135deg, #b52330 0%, #8a131e 100%);
          color: #ffffff;
          font-weight: 800;
          font-size: ${count >= 100 ? '11px' : '13px'};
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
          border: ${hasSelected ? '3px solid #ffdbde' : '2.5px solid #ffffff'};
          box-shadow: ${
            hasSelected
              ? '0 0 0 4px rgba(181, 35, 48, 0.4), 0 6px 18px rgba(0,0,0,0.45)'
              : '0 4px 14px rgba(181, 35, 48, 0.4), 0 2px 6px rgba(0,0,0,0.3)'
          };
          cursor: pointer;
          user-select: none;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
          letter-spacing: 0.5px;
          transition: transform 0.15s ease;
        "
        title="${count} places grouped together. Click to zoom in."
      >
        ${count}+
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [half, half],
  });
}

function SheltersClusterLayer({
  locations,
  selectedPlaceId,
  onSelectPlace,
}: {
  locations: MapPlace[];
  selectedPlaceId?: string | number | null;
  onSelectPlace?: (place: MapPlace) => void;
}) {
  const { t } = useTranslation();
  const map = useMap();
  const [zoom, setZoom] = useState<number>(() => {
    if (map && typeof map.getZoom === 'function') {
      return map.getZoom() || 12;
    }
    return 12;
  });

  // Keep zoom updated
  useMapEvents({
    zoomend: (e) => {
      const z = e.target?.getZoom?.();
      if (typeof z === 'number') setZoom(z);
    },
  });

  // Calculate clusters based on locations and current zoom
  const clusters = useMemo(() => {
    return clusterPlaces(locations, zoom);
  }, [locations, zoom]);

  const handleClusterClick = (cluster: PlaceCluster) => {
    if (!map) return;
    const [[minLat, minLng], [maxLat, maxLng]] = cluster.bounds;

    // If places are at identical or virtually identical coordinates
    if (Math.abs(minLat - maxLat) < 0.0001 && Math.abs(minLng - maxLng) < 0.0001) {
      if (typeof map.setView === 'function') {
        map.setView([cluster.lat, cluster.lng], Math.min(zoom + 3, 17));
      }
    } else if (typeof map.fitBounds === 'function') {
      map.fitBounds(cluster.bounds, {
        padding: [60, 60],
        maxZoom: 16,
      });
    }
  };

  return (
    <>
      {clusters.map((cluster) => {
        // Group of 2 or more places: render custom cluster bubble showing x+
        if (cluster.isCluster) {
          const hasSelected =
            selectedPlaceId != null &&
            cluster.places.some((p) => String(p.id) === String(selectedPlaceId));

          return (
            <Marker
              key={cluster.id}
              position={[cluster.lat, cluster.lng]}
              icon={createClusterIcon(cluster.places.length, hasSelected)}
              eventHandlers={{
                click: () => handleClusterClick(cluster),
              }}
            >
              <span className="sr-only">{cluster.places.length}+</span>
              <Popup>
                <div className="text-center p-1 font-sans">
                  <div className="font-bold text-sm text-on-background">
                    {cluster.places.length} places in this area
                  </div>
                  <p className="text-xs text-secondary mt-1 mb-2">
                    {cluster.places.slice(0, 3).map((p) => p.name || 'Unnamed place').join(', ')}
                    {cluster.places.length > 3 ? ` and ${cluster.places.length - 3} more` : ''}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleClusterClick(cluster)}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-primary text-white text-xs font-bold rounded-lg shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">zoom_in</span>
                    Zoom to view all
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        }

        // Single place: render individual circle marker
        const loc = cluster.places[0];
        const pos: [number, number] = [cluster.lat, cluster.lng];
        const color =
          loc.type === 'vet'
            ? VET_COLOR
            : loc.type === 'shelter'
              ? SHELTER_COLOR
              : loc.type === 'cat_cafe'
                ? CAT_CAFE_COLOR
                : OTHER_COLOR;
        const isSelected = selectedPlaceId != null && String(loc.id) === String(selectedPlaceId);
        const radius = isSelected ? 13 : 9;
        const weight = isSelected ? 3 : 1.5;

        return (
          <CircleMarker
            key={String(loc.id ?? `${pos[0]}-${pos[1]}`)}
            center={pos}
            radius={radius}
            pathOptions={{
              color: isSelected ? '#111827' : color,
              fillColor: color,
              fillOpacity: 0.9,
              weight,
            }}
            eventHandlers={{
              click: () => onSelectPlace?.(loc),
            }}
          >
            <Popup>
              <strong>{loc.name || t('shelters.unnamedPlace')}</strong>
              {loc.address && (
                <>
                  <br />
                  {loc.address}
                </>
              )}
              {loc.phone && (
                <>
                  <br />
                  <span>Tel: {loc.phone}</span>
                </>
              )}
              {typeof loc.isOpen === 'boolean' && (
                <>
                  <br />
                  <span
                    style={{
                      color: loc.isOpen ? SHELTER_COLOR : VET_COLOR,
                      fontWeight: 'bold',
                    }}
                  >
                    {loc.isOpen ? t('shelters.openNow') : t('shelters.closed')}
                  </span>
                </>
              )}
              <div className="mt-2 pt-1 border-t border-gray-100">
                <a
                  href={buildGoogleMapsUrl({
                    name: loc.name,
                    address: loc.address,
                    lat: pos[0],
                    lng: pos[1],
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary font-bold hover:underline"
                >
                  <span className="material-symbols-outlined text-[13px]">directions</span>
                  {t('shelters.openInGoogleMaps')}
                </a>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

export function SheltersMap({
  locations,
  center = [51.2194, 4.4025],
  zoom = 12,
  userLocation,
  selectedPlaceId,
  onBoundsChange,
  onZoomChange,
  onSelectPlace,
  isSearchingArea = false,
  onSearchThisArea,
}: SheltersMapProps) {
  const { t } = useTranslation();
  return (
    <div
      className="relative w-full h-full"
      role="region"
      aria-label={t('shelters.mapAriaLabel')}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        className="w-full h-full"
        aria-label={t('shelters.mapAriaLabel')}
      >
        <BaseTileLayer />
        <ChangeView center={center} zoom={zoom} />
        <MapEventsListener onBoundsChange={onBoundsChange} onZoomChange={onZoomChange} />

        {/* User current location marker */}
        {userLocation && userLocation[0] !== 0 && (
          <CircleMarker
            center={userLocation}
            radius={7}
            pathOptions={{
              color: '#1d4ed8',
              fillColor: '#3b82f6',
              fillOpacity: 0.95,
              weight: 3,
            }}
          >
            <Popup>
              <div className="text-center font-bold text-xs py-1">{t('shelters.yourLocation')}</div>
            </Popup>
          </CircleMarker>
        )}

        {/* Clustered places layer: groups places into x+ bubbles when zoomed out */}
        <SheltersClusterLayer
          locations={locations}
          selectedPlaceId={selectedPlaceId}
          onSelectPlace={onSelectPlace}
        />
      </MapContainer>

      {/* Floating "Search this area" button / loading indicator */}
      {(onSearchThisArea || isSearchingArea) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto">
          {isSearchingArea ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-on-background/90 text-white text-xs font-bold rounded-full shadow-lg backdrop-blur-md border border-white/10 animate-pulse">
              <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              {t('shelters.searchingArea')}
            </div>
          ) : onSearchThisArea ? (
            <button
              type="button"
              onClick={onSearchThisArea}
              className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-neutral-50 text-on-background text-xs font-bold rounded-full shadow-lg border border-outline-variant/30 transition-all hover:scale-105 cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px] text-primary">search</span>
              {t('shelters.searchThisArea')}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
