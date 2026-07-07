export type SightingStatus = 'MISSING' | 'RECENTLY_SEEN' | 'FOUND' | 'CLOSED';

export interface CatSighting {
  id: string;
  cat_name: string;
  status: SightingStatus;
  last_seen_lat: number;
  last_seen_lng: number;
  last_seen_address: string;
  last_seen_landmark: string | null;
  coat_color: string;
  breed: string | null;
  description: string;
  created_at: string;
  // mock-only: real API will not include this field
  _mockImageUrl?: string;
}

export const MOCK_SIGHTINGS: CatSighting[] = [
  {
    id: '1',
    cat_name: 'Milo',
    status: 'MISSING',
    last_seen_lat: 51.2204,
    last_seen_lng: 4.4019,
    last_seen_address: 'Grote Markt, 2000 Antwerp',
    last_seen_landmark: 'Near the main square fountain',
    coat_color: 'orange tabby',
    breed: 'Domestic Shorthair',
    description:
      'Last seen near Grote Markt. Wearing a small blue collar with a bell. Very friendly but shy.',
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    _mockImageUrl:
      'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=300&fit=crop',
  },
  {
    id: '2',
    cat_name: 'Unknown Black Cat',
    status: 'RECENTLY_SEEN',
    last_seen_lat: 51.2232,
    last_seen_lng: 4.4111,
    last_seen_address: 'University Quarter, Antwerp',
    last_seen_landmark: null,
    coat_color: 'black',
    breed: null,
    description:
      'Spotted near the University area. No collar visible. Seemed well-fed and cautious.',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    _mockImageUrl:
      'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=300&fit=crop',
  },
  {
    id: '3',
    cat_name: 'Luna',
    status: 'MISSING',
    last_seen_lat: 51.208,
    last_seen_lng: 4.425,
    last_seen_address: 'Zurenborg, Antwerp',
    last_seen_landmark: 'Near Cogels-Osylei',
    coat_color: 'calico',
    breed: 'Domestic Shorthair',
    description:
      'Missing from Zurenborg district. She is a small calico cat with distinct black patches.',
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    _mockImageUrl:
      'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=400&h=300&fit=crop',
  },
  {
    id: '4',
    cat_name: 'Grey Scottish Fold',
    status: 'RECENTLY_SEEN',
    last_seen_lat: 51.196,
    last_seen_lng: 4.395,
    last_seen_address: 'Nieuw Zuid, Antwerp',
    last_seen_landmark: 'Apartment complex courtyard',
    coat_color: 'grey',
    breed: 'Scottish Fold',
    description:
      'Seen roaming the Nieuw Zuid courtyards. Very calm, likely lives in the building complex.',
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    _mockImageUrl:
      'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=400&h=300&fit=crop',
  },
];

export const STATUS_LABELS: Record<SightingStatus, string> = {
  MISSING: 'Missing',
  RECENTLY_SEEN: 'Sighted',
  FOUND: 'Found',
  CLOSED: 'Closed',
};
