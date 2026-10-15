import { useMemo } from 'react';
import { X } from 'lucide-react';
import { hotels } from '@/data/hotels';
import { SelectedHotel } from '@/hooks/useMarkerPositions';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SelectedHotelsPanelProps {
  selectedHotels: SelectedHotel[];
  onDeselectHotel: (hotelId: string) => void;
}

/** Numbered map key shown beside the map on desktop — mirrors the PDF legend. */
export function SelectedHotelsPanel({ selectedHotels, onDeselectHotel }: SelectedHotelsPanelProps) {
  const rows = useMemo(
    () =>
      [...selectedHotels]
        .sort((a, b) => a.number - b.number)
        .map((sh) => ({ sh, hotel: hotels.find((h) => h.id === sh.hotelId) }))
        .filter((r) => r.hotel),
    [selectedHotels]
  );

  return (
    <div className="flex h-full flex-col bg-panel-bg">
      <div className="bg-panel-header px-4 py-4">
        <h2 className="font-display text-xl font-bold uppercase tracking-wider text-primary-foreground">
          Map Key
        </h2>
        <p className="mt-1 text-sm text-primary-foreground/80">
          {rows.length} selected
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          Select hotels from the list to number them on the map.
        </p>
      ) : (
        <ScrollArea className="flex-1">
          <ol className="p-2" aria-label="Selected hotels in map order">
            {rows.map(({ sh, hotel }) => (
              <li
                key={sh.hotelId}
                className="group flex items-start gap-2 border-b border-border px-2 py-2 last:border-b-0"
              >
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-marker-bg text-xs font-bold text-marker-text">
                  {sh.number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold leading-tight text-foreground">{hotel!.name}</p>
                  <p className="mt-0.5 text-xs text-primary">{hotel!.distanceFromACC} mi from ACC</p>
                </div>
                <button
                  type="button"
                  onClick={() => onDeselectHotel(sh.hotelId)}
                  aria-label={`Remove ${hotel!.name}`}
                  className="flex-shrink-0 rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ol>
        </ScrollArea>
      )}
    </div>
  );
}
