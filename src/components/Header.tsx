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
          <img
            src="/images/palm-mark.png"
            alt="Visit Anaheim"
            className="h-10 w-10"
          />
          <p className="text-sm font-medium mt-1" style={{ color: '#43A3A3' }}>
            Custom Hotel Map Tool
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {selectedHotels.length > 0 && (
          <Button
            variant="outline"
            onClick={onClearAll}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
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
