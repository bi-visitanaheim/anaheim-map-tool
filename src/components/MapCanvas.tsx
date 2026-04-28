import { useRef } from 'react';
import { DraggableMarker } from './DraggableMarker';
import { SelectedHotel } from '@/hooks/useMarkerPositions';

interface MapCanvasProps {
  selectedHotels: SelectedHotel[];
  onUpdatePosition: (hotelId: string, x: number, y: number) => void;
  readOnly?: boolean;
}

export function MapCanvas({ selectedHotels, onUpdatePosition, readOnly = false }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  return (
    <div
      id="map-container"
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-lg"
    >
      <img
        ref={imageRef}
        src="/images/anaheim-map.jpg"
        alt="Anaheim Convention Center Area Map"
        className="h-full w-full object-contain"
        draggable={false}
      />
      {selectedHotels.map((sh) => (
        sh.position && (
          <DraggableMarker
            key={sh.hotelId}
            number={sh.number}
            percentX={sh.position.x}
            percentY={sh.position.y}
            onPositionChange={(x, y) => onUpdatePosition(sh.hotelId, x, y)}
            containerRef={containerRef}
            imageRef={imageRef}
            readOnly={readOnly}
          />
        )
      ))}
    </div>
  );
}
