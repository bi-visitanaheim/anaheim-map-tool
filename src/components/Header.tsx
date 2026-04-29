import { ExportButton } from './ExportButton';
import { Button } from '@/components/ui/button';
import { SelectedHotel } from '@/hooks/useMarkerPositions';
import { Trash2 } from 'lucide-react';

interface HeaderProps {
  selectedHotels: SelectedHotel[];
  onClearAll: () => void;
}

export function Header({ selectedHotels, onClearAll }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4 shadow-soft">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight" style={{ color: '#004183' }}>
            Visit Anaheim Hotel Planner
          </h1>
          <p className="text-sm font-medium" style={{ color: '#89cce2' }}>
            Hotel Itinerary Builder
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {selectedHotels.length > 0 && (
          <Button
            variant="outline"
            onClick={onClearAll}
            className="text-muted-foreground hover:text-destructive hover:border-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear All ({selectedHotels.length})
          </Button>
        )}
        <ExportButton selectedHotels={selectedHotels} />
      </div>
    </header>
  );
}
