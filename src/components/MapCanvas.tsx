import { useRef, useState, useEffect } from 'react';
import { DraggableMarker } from './DraggableMarker';
import { SelectedHotel, MarkerPosition } from '@/hooks/useMarkerPositions';

interface MapCanvasProps {
  selectedHotels: SelectedHotel[];
  onUpdatePosition: (hotelId: string, position: MarkerPosition) => void;
}

export function MapCanvas({ selectedHotels, onUpdatePosition }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    // Pre-load the image
    const img = new Image();
    img.onload = () => setMapLoaded(true);
    img.onerror = () => {
      console.error('Failed to load map image');
      setMapError(true);
    };
    img.src = '/images/map-template.jpg';
  }, []);

  // Position is already stored as percentages (0-100), pass directly to marker
  const handlePositionChange = (hotelId: string, percentX: number, percentY: number) => {
    onUpdatePosition(hotelId, { x: percentX, y: percentY });
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-anaheim-peach shadow-soft">
      {/* Container ref wraps only the image area - markers are positioned relative to this */}
      <div 
        ref={containerRef}
        className="relative h-full w-full"
        id="map-container"
      >
        {mapError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="text-center text-muted-foreground">
              <p>Failed to load map</p>
              <button 
                onClick={() => window.location.reload()} 
                className="mt-2 text-primary underline"
              >
                Reload page
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Image fills container completely - no letterboxing */}
            <img
              src="/images/map-template.jpg"
              alt="Anaheim Area Map"
              className="absolute inset-0 h-full w-full object-cover"
              onLoad={() => setMapLoaded(true)}
              onError={() => setMapError(true)}
              draggable={false}
            />
            
            {mapLoaded && selectedHotels.map((hotel) => {
              // Pass percentage positions directly - default to center if no position
              const percentX = hotel.position?.x ?? 50;
              const percentY = hotel.position?.y ?? 50;
              
              return (
                <DraggableMarker
                  key={hotel.hotelId}
                  number={hotel.number}
                  initialPercentX={percentX}
                  initialPercentY={percentY}
                  onPositionChange={(x, y) => handlePositionChange(hotel.hotelId, x, y)}
                  containerRef={containerRef}
                />
              );
            })}

            {!mapLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                  <span>Loading map...</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
