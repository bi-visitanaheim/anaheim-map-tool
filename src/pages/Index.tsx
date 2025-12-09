import { useMarkerPositions } from '@/hooks/useMarkerPositions';
import { HotelListPanel } from '@/components/HotelListPanel';
import { MapCanvas } from '@/components/MapCanvas';
import { Header } from '@/components/Header';

const Index = () => {
  const {
    selectedHotels,
    selectHotel,
    deselectHotel,
    updateMarkerPosition,
    clearAllSelections,
    getHotelNumber,
  } = useMarkerPositions();

  const selectedHotelIds = selectedHotels.map(h => h.hotelId);

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header 
        selectedHotels={selectedHotels} 
        onClearAll={clearAllSelections} 
      />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Hotel List Panel - Fixed Width */}
        <aside className="w-80 flex-shrink-0 border-r border-border overflow-hidden">
          <HotelListPanel
            selectedHotelIds={selectedHotelIds}
            onSelectHotel={selectHotel}
            onDeselectHotel={deselectHotel}
            getHotelNumber={getHotelNumber}
          />
        </aside>

        {/* Map Area - Flexible */}
        <main className="flex-1 overflow-hidden p-4">
          <MapCanvas
            selectedHotels={selectedHotels}
            onUpdatePosition={updateMarkerPosition}
          />
        </main>
      </div>

      {/* Instructions Footer */}
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
          <span className="text-xs">
            Marker positions are saved automatically
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
