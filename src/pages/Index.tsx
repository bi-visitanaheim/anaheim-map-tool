import { useState, useRef, useCallback, useEffect } from 'react';
import { useMarkerPositions } from '@/hooks/useMarkerPositions';
import { HotelListPanel } from '@/components/HotelListPanel';
import { MapCanvas } from '@/components/MapCanvas';
import { Header } from '@/components/Header';
import { SelectedHotelsPanel } from '@/components/SelectedHotelsPanel';
import { useLayoutMode } from '@/hooks/useLayoutMode';
import { cn } from '@/lib/utils';

const MIN_PANEL_WIDTH = 200;
const MAX_PANEL_WIDTH = 500;
const DEFAULT_PANEL_WIDTH = 320;

const Index = () => {
  const {
    selectedHotels,
    selectHotel,
    deselectHotel,
    clearAllSelections,
    getHotelNumber,
    isLoaded,
  } = useMarkerPositions();

  const selectedHotelIds = selectedHotels.map(h => h.hotelId);
  const layoutMode = useLayoutMode();
  const [mobileTab, setMobileTab] = useState<'map' | 'hotels'>('map');

  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('hotelPanelWidth');
    return saved ? Math.min(Math.max(parseInt(saved, 10), MIN_PANEL_WIDTH), MAX_PANEL_WIDTH) : DEFAULT_PANEL_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('hotelPanelWidth', panelWidth.toString());
  }, [panelWidth]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      setPanelWidth(Math.min(Math.max(newWidth, MIN_PANEL_WIDTH), MAX_PANEL_WIDTH));
    };
    const handleMouseUp = () => setIsResizing(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-sm">Loading map…</span>
        </div>
      </div>
    );
  }

  // ── Phones / portrait tablets: Map | Hotels tabs ─────────────────────────────
  // Both panels stay mounted (inactive one hidden) so the PDF export can always
  // read the map image and marker state from the DOM.
  if (layoutMode === 'mobile') {
    const tabs = [
      { id: 'map' as const, label: 'Map' },
      { id: 'hotels' as const, label: `Hotels (${selectedHotels.length})` },
    ];
    return (
      <div className="flex h-[100dvh] flex-col bg-background">
        <Header selectedHotels={selectedHotels} onClearAll={clearAllSelections} compact />

        <div role="tablist" aria-label="View" className="grid grid-cols-2 gap-1 border-b border-border bg-card p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={mobileTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setMobileTab(tab.id)}
              className={cn(
                'rounded-md py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                mobileTab === tab.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <main
          id="panel-map"
          role="tabpanel"
          aria-labelledby="tab-map"
          className={cn('flex-1 overflow-hidden p-2', mobileTab !== 'map' && 'hidden')}
        >
          <MapCanvas selectedHotels={selectedHotels} />
        </main>
        <section
          id="panel-hotels"
          role="tabpanel"
          aria-labelledby="tab-hotels"
          className={cn('flex-1 overflow-hidden', mobileTab !== 'hotels' && 'hidden')}
        >
          <HotelListPanel
            selectedHotelIds={selectedHotelIds}
            onSelectHotel={selectHotel}
            onDeselectHotel={deselectHotel}
            getHotelNumber={getHotelNumber}
          />
        </section>
      </div>
    );
  }

  // ── Desktop / laptop (landscape): hotel list | map | map key ─────────────────
  return (
    <div className="flex h-screen flex-col bg-background">
      <Header
        selectedHotels={selectedHotels}
        onClearAll={clearAllSelections}
      />

      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        <aside
          className="flex-shrink-0 border-r border-border overflow-hidden"
          style={{ width: panelWidth }}
        >
          <HotelListPanel
            selectedHotelIds={selectedHotelIds}
            onSelectHotel={selectHotel}
            onDeselectHotel={deselectHotel}
            getHotelNumber={getHotelNumber}
          />
        </aside>

        <div
          onMouseDown={handleMouseDown}
          className={`w-1 flex-shrink-0 cursor-col-resize bg-border transition-colors duration-150 hover:bg-primary/50 active:bg-primary ${isResizing ? 'bg-primary' : ''}`}
          title="Drag to resize panel"
        />

        <main className="min-w-0 flex-1 overflow-hidden p-4">
          <MapCanvas
            selectedHotels={selectedHotels}
          />
        </main>

        <aside className="w-64 flex-shrink-0 overflow-hidden border-l border-border xl:w-72" aria-label="Map key">
          <SelectedHotelsPanel selectedHotels={selectedHotels} onDeselectHotel={deselectHotel} />
        </aside>
      </div>
    </div>
  );
};

export default Index;
