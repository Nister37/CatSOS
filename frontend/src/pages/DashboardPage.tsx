import { CircleMarker, MapContainer, Popup } from 'react-leaflet';
import { BaseTileLayer } from '../components/BaseTileLayer';

const rescueLocations = [
  { id: 'warsaw', name: 'Warsaw intake hub', position: [52.2297, 21.0122] as [number, number], cases: 12 },
  { id: 'lodz', name: 'Lodz foster network', position: [51.7592, 19.456] as [number, number], cases: 7 },
  { id: 'krakow', name: 'Krakow vet partner', position: [50.0647, 19.945] as [number, number], cases: 5 },
];

export function DashboardPage() {
  return (
    <section className="page-grid" aria-labelledby="dashboard-heading">
      <div className="panel">
        <p className="eyebrow">Live overview</p>
        <h2 id="dashboard-heading">Field dashboard</h2>
        <dl className="metrics">
          <div>
            <dt>Open cases</dt>
            <dd>24</dd>
          </div>
          <div>
            <dt>Foster homes</dt>
            <dd>18</dd>
          </div>
          <div>
            <dt>Urgent cases</dt>
            <dd>4</dd>
          </div>
        </dl>
      </div>

      <div className="panel map-panel">
        <h3>Coverage map</h3>
        <MapContainer
          center={[51.9194, 19.1451]}
          zoom={6}
          scrollWheelZoom={false}
          className="map"
          aria-label="Map of active CatSOS rescue locations"
        >
          <BaseTileLayer />
          {rescueLocations.map((location) => (
            <CircleMarker center={location.position} key={location.id} radius={12}>
              <Popup>
                {location.name}: {location.cases} cases
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
        <ul className="location-list" aria-label="Rescue locations">
          {rescueLocations.map((location) => (
            <li key={location.id}>
              <span>{location.name}</span>
              <strong>{location.cases} cases</strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
