import { ExportButton } from './ExportButton';
import { Button } from '@/components/ui/button';
import { SelectedHotel } from '@/hooks/useMarkerPositions';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  selectedHotels: SelectedHotel[];
  onClearAll: () => void;
  /** Compact header for phones / portrait tablets: smaller title, icon-only buttons. */
  compact?: boolean;
}

export function Header({ selectedHotels, onClearAll, compact = false }: HeaderProps) {
  return (
    <header
      className={cn(
        'flex items-center justify-between gap-3 border-b border-border bg-card shadow-soft',
        compact ? 'px-3 py-2' : 'px-6 py-4'
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <img
          src="/images/palm-mark.png"
          alt="Visit Anaheim"
          className={cn('flex-shrink-0', compact ? 'h-8 w-8' : 'h-10 w-10')}
        />
        <div className="min-w-0">
          <h1
            className={cn('truncate font-display font-bold tracking-tight', compact ? 'text-lg' : 'text-2xl')}
            style={{ color: '#231F20' }}
          >
            Visit Anaheim
          </h1>
          <p className={cn('truncate font-medium', compact ? 'text-xs' : 'text-sm')} style={{ color: '#43A3A3' }}>
            Custom Hotel Map Tool
          </p>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
        {selectedHotels.length > 0 && (
          <Button
            variant="outline"
            size={compact ? 'icon' : 'default'}
            onClick={onClearAll}
            aria-label={compact ? `Clear all ${selectedHotels.length} selected hotels` : undefined}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
          >
            <Trash2 className={compact ? 'h-4 w-4' : 'mr-2 h-4 w-4'} />
            {!compact && `Clear All (${selectedHotels.length})`}
          </Button>
        )}
        <ExportButton selectedHotels={selectedHotels} compact={compact} />
      </div>
    </header>
  );
}
