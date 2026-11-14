import { TileLayer } from 'react-leaflet';

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export function BaseTileLayer() {
  return <TileLayer attribution={ATTRIBUTION} url={URL} maxZoom={19} />;
}
