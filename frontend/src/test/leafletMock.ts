// Minimal Leaflet stub for Jest/jsdom — prevents DOM-API errors at import time.
export class DivIcon {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(..._args: unknown[]) {}
}

const L = {
  DivIcon,
  divIcon: (options?: unknown) => new DivIcon(options),
  latLngBounds: () => ({
    getNorth: () => 0,
    getSouth: () => 0,
    getEast: () => 0,
    getWest: () => 0,
  }),
  DomEvent: {
    stopPropagation: () => {},
  },
};
export default L;
