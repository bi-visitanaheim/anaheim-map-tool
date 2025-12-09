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

  const handlePositionChange = (hotelId: string, x: number, y: number) => {
    if (containerRef.current) {
      const percentX = (x / containerRef.current.offsetWidth) * 100;
      const percentY = (y / containerRef.current.offsetHeight) * 100;
      onUpdatePosition(hotelId, { x: percentX, y: percentY });
    }
  };

  const getAbsolutePosition = (position: MarkerPosition | null) => {
    if (!position || !containerRef.current) {
      return { x: 100, y: 100 };
    }
    return {
      x: (position.x / 100) * containerRef.current.offsetWidth,
      y: (position.y / 100) * containerRef.current.offsetHeight,
    };
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-anaheim-peach shadow-soft">
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
            <img
              src="/images/map-template.jpg"
              alt="Anaheim Area Map"
              className="h-full w-full object-contain"
              onLoad={() => setMapLoaded(true)}
              onError={() => setMapError(true)}
              draggable={false}
            />
            
            {mapLoaded && selectedHotels.map((hotel) => {
              const absolutePos = getAbsolutePosition(hotel.position);
              return (
                <DraggableMarker
                  key={hotel.hotelId}
                  number={hotel.number}
                  initialX={absolutePos.x}
                  initialY={absolutePos.y}
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
