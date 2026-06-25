import type { PropsWithChildren } from 'react';

function MockLeafletElement({ children }: PropsWithChildren) {
  return <div>{children}</div>;
}

export const MapContainer = MockLeafletElement;
export const TileLayer = () => null;
export const CircleMarker = MockLeafletElement;
export const Popup = MockLeafletElement;
