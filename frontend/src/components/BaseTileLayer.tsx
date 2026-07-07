import { TileLayer } from 'react-leaflet';

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

export function BaseTileLayer() {
  return <TileLayer attribution={ATTRIBUTION} url={URL} />;
}
