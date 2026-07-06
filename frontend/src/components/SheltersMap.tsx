import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';

import { ShelterLocation } from '../data/shelters';

interface SheltersMapProps {
  locations: ShelterLocation[];
}

const VET_COLOR = '#b52330';
const SHELTER_COLOR = '#2D8C3C';

export function SheltersMap({ locations }: SheltersMapProps) {
  return (
    <MapContainer
      center={[51.2194, 4.4025]}
      zoom={12}
      scrollWheelZoom={false}
      className="w-full h-full"
      aria-label="Map of nearby shelters and veterinary clinics"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {locations.map((loc) => {
        const color = loc.type === 'vet' ? VET_COLOR : SHELTER_COLOR;
        return (
          <CircleMarker
            key={loc.id}
            center={loc.position}
            radius={12}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.8 }}
          >
            <Popup>
              <strong>{loc.name}</strong>
              <br />
              {loc.address}
              <br />
              <span style={{ color: loc.isOpen ? SHELTER_COLOR : VET_COLOR }}>
                {loc.isOpen ? 'Open Now' : 'Closed'}
              </span>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
