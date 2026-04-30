import { useState } from 'react';
import { hotels, Hotel } from '@/data/hotels';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, MapPin, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HotelListPanelProps {
  selectedHotelIds: string[];
  onSelectHotel: (hotelId: string) => void;
  onDeselectHotel: (hotelId: string) => void;
  getHotelNumber: (hotelId: string) => number | null;
}

export function HotelListPanel({
  selectedHotelIds,
  onSelectHotel,
  onDeselectHotel,
  getHotelNumber,
}: HotelListPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredHotels = hotels
    .filter(hotel =>
      hotel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hotel.city.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      // Sort by distance from ACC (ascending)
      if (a.distanceFromACC !== b.distanceFromACC) {
        return a.distanceFromACC - b.distanceFromACC;
      }
      // If same distance, sort alphabetically by name
      return a.name.localeCompare(b.name);
    });

  const handleHotelClick = (hotel: Hotel) => {
    if (selectedHotelIds.includes(hotel.id)) {
      onDeselectHotel(hotel.id);
    } else {
      if (selectedHotelIds.length < 20) {
        onSelectHotel(hotel.id);
      }
    }
  };

  return (
    <div className="flex h-full flex-col bg-panel-bg">
      {/* Header */}
      <div className="bg-panel-header px-4 py-4">
        <h1 className="font-display text-xl font-bold uppercase tracking-wider text-primary-foreground">
          Partner Hotels
        </h1>
        <p className="mt-1 text-sm text-primary-foreground/80">
          Select up to 20 hotels ({selectedHotelIds.length}/20)
        </p>
      </div>

      {/* Search */}
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search hotels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
      </div>

      {/* Hotel List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredHotels.map((hotel) => {
            const isSelected = selectedHotelIds.includes(hotel.id);
            const number = getHotelNumber(hotel.id);

            return (
              <div
                key={hotel.id}
                onClick={() => handleHotelClick(hotel)}
                className={cn(
                  "group relative mb-1 cursor-pointer rounded-md p-3 transition-all duration-200",
                  isSelected
                    ? "bg-accent/15 border border-accent"
                    : "hover:bg-muted border border-transparent"
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Number Badge or Placeholder */}
                  <div
                    className={cn(
                      "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all",
                      isSelected
                        ? "bg-accent text-accent-foreground shadow-marker"
                        : "bg-muted text-muted-foreground group-hover:bg-primary/10"
                    )}
                  >
                    {isSelected ? number : <MapPin className="h-3.5 w-3.5" />}
                  </div>

                  {/* Hotel Info */}
                  <div className="min-w-0 flex-1">
                    <h3 className={cn(
                      "break-words text-sm font-semibold leading-tight",
                      isSelected ? "text-foreground" : "text-foreground/80"
                    )}>
                      {hotel.name}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {hotel.address}, {hotel.city}
                    </p>
                    <p className="mt-0.5 text-xs text-primary">
                      {hotel.distanceFromACC} mi from ACC
                    </p>
                  </div>

                  {/* Remove button for selected */}
                  {isSelected && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeselectHotel(hotel.id);
                      }}
                      className="flex-shrink-0 rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
