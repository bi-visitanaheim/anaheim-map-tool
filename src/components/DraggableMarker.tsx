import { useState, useRef, useEffect, useCallback } from 'react';

interface ImageBounds {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

interface MapMarkerProps {
  number: number;
  percentX: number;
  percentY: number;
  containerRef: React.RefObject<HTMLDivElement>;
  imageRef: React.RefObject<HTMLImageElement>;
}

function getImageBounds(
  containerWidth: number,
  containerHeight: number,
  imageNaturalWidth: number,
  imageNaturalHeight: number
): ImageBounds {
  const imageAspect = imageNaturalWidth / imageNaturalHeight;
  const containerAspect = containerWidth / containerHeight;

  let displayedWidth: number;
  let displayedHeight: number;
  let offsetX: number;
  let offsetY: number;

  if (imageAspect > containerAspect) {
    displayedWidth = containerWidth;
    displayedHeight = containerWidth / imageAspect;
    offsetX = 0;
    offsetY = (containerHeight - displayedHeight) / 2;
  } else {
    displayedHeight = containerHeight;
    displayedWidth = containerHeight * imageAspect;
    offsetX = (containerWidth - displayedWidth) / 2;
    offsetY = 0;
  }

  return { offsetX, offsetY, width: displayedWidth, height: displayedHeight };
}

export function DraggableMarker({
  number,
  percentX,
  percentY,
  containerRef,
  imageRef,
}: MapMarkerProps) {
  const markerRef = useRef<HTMLDivElement>(null);
  const [imageBounds, setImageBounds] = useState<ImageBounds | null>(null);

  const updateImageBounds = useCallback(() => {
    if (!containerRef.current || !imageRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const { naturalWidth, naturalHeight } = imageRef.current;
    if (naturalWidth === 0 || naturalHeight === 0) return;
    setImageBounds(getImageBounds(containerRect.width, containerRect.height, naturalWidth, naturalHeight));
  }, [containerRef, imageRef]);

  useEffect(() => {
    updateImageBounds();
    const handleResize = () => updateImageBounds();
    window.addEventListener('resize', handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [updateImageBounds, containerRef]);

  const getContainerPosition = (): { left: string; top: string } => {
    if (!imageBounds || !containerRef.current) {
      return { left: `${percentX}%`, top: `${percentY}%` };
    }
    const containerRect = containerRef.current.getBoundingClientRect();
    const pixelX = imageBounds.offsetX + (percentX / 100) * imageBounds.width;
    const pixelY = imageBounds.offsetY + (percentY / 100) * imageBounds.height;
    return {
      left: `${(pixelX / containerRect.width) * 100}%`,
      top: `${(pixelY / containerRect.height) * 100}%`,
    };
  };

  const position = getContainerPosition();

  return (
    <div
      ref={markerRef}
      className="absolute flex h-5 w-5 cursor-default select-none items-center justify-center rounded-full border-[1.5px] border-marker-border bg-marker-bg font-display text-[10px] font-bold text-marker-text shadow-marker"
      style={{
        left: position.left,
        top: position.top,
        transform: 'translate(-50%, -50%)',
        zIndex: 10,
      }}
    >
      {number}
    </div>
  );
}
