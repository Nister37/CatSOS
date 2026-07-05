import type { PropsWithChildren } from 'react';

function MockLeafletElement({ children }: PropsWithChildren) {
  return <div>{children}</div>;
}

export const MapContainer = MockLeafletElement;
export const TileLayer = () => null;
export const CircleMarker = MockLeafletElement;
export const Marker = MockLeafletElement;
export const Popup = MockLeafletElement;

export const useMap = () => ({
  flyTo: () => {},
  zoomIn: () => {},
  zoomOut: () => {},
  on: () => {},
  off: () => {},
});

export const useMapEvents = (_handlers: Record<string, unknown>) => null; // eslint-disable-line @typescript-eslint/no-unused-vars
