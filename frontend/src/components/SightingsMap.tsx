import { useEffect } from 'react';
import { CircleMarker, MapContainer, Popup, useMap } from 'react-leaflet';

import { CatSighting, STATUS_LABELS } from '../data/sightings';
import { BaseTileLayer } from './BaseTileLayer';

interface SightingsMapProps {
  sightings: CatSighting[];
  center: [number, number];
}

const STATUS_COLORS: Record<CatSighting['status'], string> = {
  MISSING: '#b52330',
  RECENTLY_SEEN: '#d97706',
  FOUND: '#2D8C3C',
  CLOSED: '#5f5e5e',
};

function FlyToCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 13, { duration: 1.2 });
  }, [center, map]);
  return null;
}

export function SightingsMap({ sightings, center }: SightingsMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom={false}
      className="w-full h-full"
      aria-label="Map of active cat sightings"
    >
      <BaseTileLayer />
      <FlyToCenter center={center} />
      {sightings.map((s) => {
        const color = STATUS_COLORS[s.status];
        return (
          <CircleMarker
            key={s.id}
            center={[s.last_seen_lat, s.last_seen_lng]}
            radius={12}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.85 }}
          >
            <Popup>
              <strong>{s.cat_name}</strong>
              <br />
              <span style={{ color }}>{STATUS_LABELS[s.status]}</span>
              <br />
              {s.last_seen_address}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
