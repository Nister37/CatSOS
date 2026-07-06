export type ShelterType = 'vet' | 'shelter';

export interface ShelterHours {
  weekdays: string;
  saturday: string;
  sunday: string;
}

export interface ShelterLocation {
  id: string;
  name: string;
  type: ShelterType;
  address: string;
  distance: string;
  phone: string;
  email: string;
  hours: ShelterHours;
  description: string;
  isOpen: boolean;
  position: [number, number];
  imageUrl: string;
}

export const MOCK_LOCATIONS: ShelterLocation[] = [
  {
    id: '1',
    name: 'Paws & Claws Veterinary',
    type: 'vet',
    address: 'Meir 15, 2000 Antwerp',
    distance: '1.2 km',
    phone: '+32 3 123 4567',
    email: 'info@pawsandclaws.be',
    hours: { weekdays: '8:00 – 20:00', saturday: '9:00 – 17:00', sunday: 'Closed' },
    description:
      'Specializing in emergency feline care and surgical procedures. Highly rated by the CatSOS community for urgent response.',
    isOpen: true,
    position: [51.2215, 4.401],
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCeh7FmFb4NrLEBj9De0Yj4bYjEqnvyDMJEBlTLHwzutvKhDlIlh2C5ht1EDnrYRzNUuvRxJyYzm6zt4Z3Kn6OWx5Zdb0y_Ek1gMzIuUchttmOfMyl7Cdpz26OxnVMXEc-OJXRd4vg6iuAyhWqzLuKN78HfiQHV9Y7NnN34VTnGDTIyEQoho0LNbUo5rsxr3G0eUwtYyxlD9SnWmLpbEwBox80z4WTmBVbOAJQwLushOoNTdTRnsnIcyg',
  },
  {
    id: '2',
    name: 'Antwerp Animal Shelter',
    type: 'shelter',
    address: 'Lange Gasthuisstraat 8, 2000 Antwerp',
    distance: '2.8 km',
    phone: '+32 3 234 5678',
    email: 'contact@antwerpanimalshelter.be',
    hours: { weekdays: '9:00 – 18:00', saturday: '10:00 – 16:00', sunday: '10:00 – 14:00' },
    description:
      'Providing safe havens and adoption services for lost or abandoned cats. Equipped with scanning facilities for microchips.',
    isOpen: false,
    position: [51.217, 4.3985],
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBhgjsRgkym71XiUW-l9HtgLZcr9woKo2u4fITAESDgCWYmX-HOgdg23uCGb7y3dYlkq21K-ZMC4DIr1mCuNr15Q3h4X_VlCTttQOJhdie-PZ9uCBh5TWjM8oDA2aC3Dd34n6L7NSsuz0UrMZkLPdX8MB8fwnhObUZ-VLyBLKu91Rv2QWXj5L8TEqry_Xej70hUdI3l5uiXy7S31S3pQJgOKZ7GK7y2fRGYPjqsEM41pt1Uz-ZRQKdbsA',
  },
  {
    id: '3',
    name: 'North Side Pet Hospital',
    type: 'vet',
    address: 'Turnhoutsebaan 120, 2140 Borgerhout',
    distance: '4.5 km',
    phone: '+32 3 345 6789',
    email: 'emergency@northsidepet.be',
    hours: { weekdays: '0:00 – 24:00', saturday: '0:00 – 24:00', sunday: '0:00 – 24:00' },
    description:
      '24/7 Emergency hospital with specialized diagnostic imaging and a dedicated cat-only ward for stress-free recovery.',
    isOpen: true,
    position: [51.228, 4.439],
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDC5BNTcMfqI5aOFRljJ--rAkgCh7EcLqXmQw19idvwO5OpwcueZreaKlS8OAu2RT4FM7okbPsDk3BUCxOBn_16_sUZALQvJPG_XSj0bPPo8kb61NIIPC-yr-aTyB4FJ5T5YIveqpWIdbnZrhrl_MzEuyz9k1iIMpOQsvQi58oggazyIVaVYo309Z4LiJJfGCskyJvROH87fQ8H3VQUkbdDAq6AFFMgfSwwFP5HeQeHBpLkPUGiIUg6zEA',
  },
  {
    id: '4',
    name: 'Dierenkliniek Berchem',
    type: 'vet',
    address: 'Driekoningenstraat 50, 2600 Berchem',
    distance: '5.1 km',
    phone: '+32 3 456 7890',
    email: 'info@dierenkliniekberchem.be',
    hours: { weekdays: '8:30 – 19:00', saturday: '9:00 – 13:00', sunday: 'Closed' },
    description:
      'Full-service veterinary practice with experienced feline specialists. Offers preventive care, dental services, and in-house laboratory.',
    isOpen: true,
    position: [51.199, 4.419],
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCeh7FmFb4NrLEBj9De0Yj4bYjEqnvyDMJEBlTLHwzutvKhDlIlh2C5ht1EDnrYRzNUuvRxJyYzm6zt4Z3Kn6OWx5Zdb0y_Ek1gMzIuUchttmOfMyl7Cdpz26OxnVMXEc-OJXRd4vg6iuAyhWqzLuKN78HfiQHV9Y7NnN34VTnGDTIyEQoho0LNbUo5rsxr3G0eUwtYyxlD9SnWmLpbEwBox80z4WTmBVbOAJQwLushOoNTdTRnsnIcyg',
  },
  {
    id: '5',
    name: 'Hoboken Cat Rescue',
    type: 'shelter',
    address: 'Emiel Vloorstraat 22, 2660 Hoboken',
    distance: '6.3 km',
    phone: '+32 3 567 8901',
    email: 'rescue@hobokencats.be',
    hours: { weekdays: '10:00 – 17:00', saturday: '10:00 – 16:00', sunday: 'Closed' },
    description:
      'Community-run rescue specialising in TNR (Trap-Neuter-Return) programs and rehabilitating feral cats for adoption.',
    isOpen: true,
    position: [51.185, 4.35],
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBhgjsRgkym71XiUW-l9HtgLZcr9woKo2u4fITAESDgCWYmX-HOgdg23uCGb7y3dYlkq21K-ZMC4DIr1mCuNr15Q3h4X_VlCTttQOJhdie-PZ9uCBh5TWjM8oDA2aC3Dd34n6L7NSsuz0UrMZkLPdX8MB8fwnhObUZ-VLyBLKu91Rv2QWXj5L8TEqry_Xej70hUdI3l5uiXy7S31S3pQJgOKZ7GK7y2fRGYPjqsEM41pt1Uz-ZRQKdbsA',
  },
  {
    id: '6',
    name: 'Dierenasiel Mortsel',
    type: 'shelter',
    address: 'Kontichsesteenweg 15, 2640 Mortsel',
    distance: '7.8 km',
    phone: '+32 3 678 9012',
    email: 'info@dierenasiel-mortsel.be',
    hours: { weekdays: '9:00 – 17:00', saturday: '10:00 – 15:00', sunday: 'Closed' },
    description:
      'Municipal shelter with modern facilities for strays and surrendered pets. Offers microchip scanning, fostering programs, and adoption events.',
    isOpen: false,
    position: [51.166, 4.458],
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBhgjsRgkym71XiUW-l9HtgLZcr9woKo2u4fITAESDgCWYmX-HOgdg23uCGb7y3dYlkq21K-ZMC4DIr1mCuNr15Q3h4X_VlCTttQOJhdie-PZ9uCBh5TWjM8oDA2aC3Dd34n6L7NSsuz0UrMZkLPdX8MB8fwnhObUZ-VLyBLKu91Rv2QWXj5L8TEqry_Xej70hUdI3l5uiXy7S31S3pQJgOKZ7GK7y2fRGYPjqsEM41pt1Uz-ZRQKdbsA',
  },
  {
    id: '7',
    name: 'Rivierenhof Veterinary',
    type: 'vet',
    address: 'Turnhoutsebaan 20, 2100 Deurne',
    distance: '8.4 km',
    phone: '+32 3 789 0123',
    email: 'hello@rivierenhofvet.be',
    hours: { weekdays: '8:00 – 18:30', saturday: '9:00 – 13:00', sunday: 'Closed' },
    description:
      'Boutique clinic focused on cats and small animals. Calm, low-stress environment with Fear Free certified staff.',
    isOpen: true,
    position: [51.229, 4.478],
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCeh7FmFb4NrLEBj9De0Yj4bYjEqnvyDMJEBlTLHwzutvKhDlIlh2C5ht1EDnrYRzNUuvRxJyYzm6zt4Z3Kn6OWx5Zdb0y_Ek1gMzIuUchttmOfMyl7Cdpz26OxnVMXEc-OJXRd4vg6iuAyhWqzLuKN78HfiQHV9Y7NnN34VTnGDTIyEQoho0LNbUo5rsxr3G0eUwtYyxlD9SnWmLpbEwBox80z4WTmBVbOAJQwLushOoNTdTRnsnIcyg',
  },
  {
    id: '8',
    name: 'Zwijndrecht Cat Haven',
    type: 'shelter',
    address: 'Burchtstraat 4, 2070 Zwijndrecht',
    distance: '9.2 km',
    phone: '+32 3 890 1234',
    email: 'adopt@zwijndrechtcathaven.be',
    hours: { weekdays: '10:00 – 18:00', saturday: '10:00 – 17:00', sunday: '12:00 – 16:00' },
    description:
      'Dedicated cat shelter with a lifetime care guarantee for unadoptable cats. Partners with local vets for all medical needs.',
    isOpen: true,
    position: [51.211, 4.33],
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBhgjsRgkym71XiUW-l9HtgLZcr9woKo2u4fITAESDgCWYmX-HOgdg23uCGb7y3dYlkq21K-ZMC4DIr1mCuNr15Q3h4X_VlCTttQOJhdie-PZ9uCBh5TWjM8oDA2aC3Dd34n6L7NSsuz0UrMZkLPdX8MB8fwnhObUZ-VLyBLKu91Rv2QWXj5L8TEqry_Xej70hUdI3l5uiXy7S31S3pQJgOKZ7GK7y2fRGYPjqsEM41pt1Uz-ZRQKdbsA',
  },
];
