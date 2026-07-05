interface MissingCatCardProps {
  name: string;
  photo: string;
  area: string;
  lastSeen: string;
}

export function MissingCatCard({ name, photo, area, lastSeen }: MissingCatCardProps) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-surface-container cat-card-shadow group">
      <div className="relative h-64 overflow-hidden">
        <img
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          alt={`${name}, a missing cat`}
          src={photo}
        />
        <div className="absolute top-4 left-4 bg-primary-container text-on-primary px-3 py-1 rounded-full font-label-md text-label-md font-bold uppercase tracking-wider shadow-md">
          Missing
        </div>
      </div>
      <div className="p-md">
        <h3 className="font-headline-md text-headline-md text-on-background mb-xs">{name}</h3>
        <div className="flex items-center gap-xs text-secondary mb-1">
          <span className="material-symbols-outlined text-sm">location_on</span>
          <span className="font-body-md text-body-md">{area}</span>
        </div>
        <div className="flex items-center gap-xs text-secondary">
          <span className="material-symbols-outlined text-sm">calendar_today</span>
          <span className="font-body-md text-body-md italic">Seen: {lastSeen}</span>
        </div>
      </div>
    </div>
  );
}
