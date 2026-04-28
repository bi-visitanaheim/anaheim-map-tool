import { useState, useRef, useCallback, useEffect } from 'react';
import { useMarkerPositions } from '@/hooks/useMarkerPositions';
import { HotelListPanel } from '@/components/HotelListPanel';
import { MapCanvas } from '@/components/MapCanvas';
import { Header } from '@/components/Header';

const MIN_PANEL_WIDTH = 200;
const MAX_PANEL_WIDTH = 500;
const DEFAULT_PANEL_WIDTH = 320;

const Index = () => {
  const {
    selectedHotels,
    selectHotel,
    deselectHotel,
    updateMarkerPosition,
    clearAllSelections,
    getHotelNumber,
    isLoaded,
  } = useMarkerPositions();

  // Client view mode: ?view=client hides instructions and disables dragging
  const isClientView = new URLSearchParams(window.location.search).get('view') === 'client';

  const selectedHotelIds = selectedHotels.map(h => h.hotelId);

  // Panel resize state
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('hotelPanelWidth');
    return saved ? Math.min(Math.max(parseInt(saved, 10), MIN_PANEL_WIDTH), MAX_PANEL_WIDTH) : DEFAULT_PANEL_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Save panel width to localStorage
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
      const clampedWidth = Math.min(Math.max(newWidth, MIN_PANEL_WIDTH), MAX_PANEL_WIDTH);
      setPanelWidth(clampedWidth);
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

  // Show a brief loading screen while IndexedDB restores saved state
  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-sm">Restoring saved selections…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header
        selectedHotels={selectedHotels}
        onClearAll={clearAllSelections}
      />

      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* Hotel List Panel — Resizable */}
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

        {/* Resize Handle */}
        <div
          onMouseDown={handleMouseDown}
          className={`
            w-1 flex-shrink-0 cursor-col-resize bg-border
            transition-colors duration-150
            hover:bg-primary/50 active:bg-primary
            ${isResizing ? 'bg-primary' : ''}
          `}
          title="Drag to resize panel"
        />

        {/* Map Area */}
        <main className="flex-1 overflow-hidden p-4">
          <MapCanvas
            selectedHotels={selectedHotels}
            onUpdatePosition={updateMarkerPosition}
            readOnly={isClientView}
          />
        </main>
      </div>

      {/* Instructions Footer — hidden in client view */}
      {!isClientView && (
        <footer className="border-t border-border bg-card px-6 py-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-6">
              <span>
                <strong className="text-foreground">1.</strong> Click hotels to select (max 20)
              </span>
              <span>
                <strong className="text-foreground">2.</strong> Drag markers to position on map
              </span>
              <span>
                <strong className="text-foreground">3.</strong> Export as high-quality PDF
              </span>
            </div>
            <span className="text-xs italic">
              Marker positions are saved automatically | Source: Hotel names and addresses are updated via Simpleview.
            </span>
          </div>
        </footer>
      )}
    </div>
  );
};

export default Index;
