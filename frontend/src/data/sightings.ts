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
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDadfJFoZVlIjpYJ9Q2Vcf2QLYwrZdujb7ugM7V4GR6f5QUYsFAEnpB7S_eFWgE185jZovuNQraKlFuiF0z2sxva1IwBLKset-7fh_IeEnu9FXknZkMyUt_-iedlbBFphPh_6PgPpIOhiaSVlxNsqWI4bmZuqoiX57dmn7h_gXLfKOQFyng3upq_RS226JCzqTxUVmZkalGOkERGUAb8nVNlVHqEgSjo2VEBN4zNODt7cvy1XOsBWa1DQ',
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
      'https://lh3.googleusercontent.com/aida-public/AB6AXuA8swWkXiT1EkHLpi86ks_D_h5FR2E9cqFFmE_QN8VV-n6spgmV7pb7yphD6pueCVi9ZY41h3kyEDFKDlsbky_K5rkaNY0Xh45GuHnmzDkz_0N8o3z767YqcM78y57kds5CXK_gm8qIJQJqSJ89kIrVPFNiyr7nXrBqLsvLZyR2MOOW3gWqP1hr-yshI6XQ_50188T6a0qHaBcH5NFKuBM_VchjHXPwc5DcDA1V3jQCx4YX1FIFIHSn5Q',
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
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAynJ65y-hF2yp98TRYp-0RVbGHGZB__mzCQxwrZMWv5pbSwfrzR4xBIi7yROMEhsWyU7cgFXZzJyjHRGt3jRpKo1_GQG_KfcISeVrlKbOKW5w5BBcU1-3K7xcVbzGUXJOkyKyXvwFrQfRO6w-z4Z5zARYvcXWZwKD9VCNDLpyKIq8Nork0FqcyS_OpEw0iVcgOMSwsNfk3K-eYJ0Edh0ZKU0txc6G8kNhE_sk6BUPKwjhNU0TYoc5B-Q',
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
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD2jbocOJhASOoHyq-kQP9YbkAq467DP88IuNVlAU4IvfUyCW7Hhs3lOncbsyhvPIWdVShUFdg5rWy5nzhbz38VuMzBVhxuWlw1jaOa86K54CrpAzq4EHhK8VeZ3H7A0idQl7JA1Yb_dfGcShxkvbjRh714eigmC-wTLwOPCjqi6-J94ie8B0L97yzIOJiqk9a6SzR_Sw0su3JlXrbJ_qlWad2dWAPInHPglczAsWzvXGycw0hHAfif8A',
  },
];

export const STATUS_LABELS: Record<SightingStatus, string> = {
  MISSING: 'Missing',
  RECENTLY_SEEN: 'Sighted',
  FOUND: 'Found',
  CLOSED: 'Closed',
};
