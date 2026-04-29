import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface ImageBounds {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

interface DraggableMarkerProps {
  number: number;
  percentX: number;
  percentY: number;
  onPositionChange: (percentX: number, percentY: number) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  imageRef: React.RefObject<HTMLImageElement>;
  locked?: boolean;
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
  onPositionChange,
  containerRef,
  imageRef,
  locked = false,
}: DraggableMarkerProps) {
  const [imagePercent, setImagePercent] = useState({ x: percentX, y: percentY });
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaced, setIsPlaced] = useState(percentX !== 0 || percentY !== 0);
  const [imageBounds, setImageBounds] = useState<ImageBounds | null>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

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

  useEffect(() => {
    if (!isDragging) {
      setImagePercent({ x: percentX, y: percentY });
      if (percentX !== 0 || percentY !== 0) setIsPlaced(true);
    }
  }, [percentX, percentY, isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (locked) return;
    e.preventDefault();
    setIsDragging(true);
    updateImageBounds();
    const rect = markerRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffsetRef.current = {
        x: e.clientX - rect.left - rect.width / 2,
        y: e.clientY - rect.top - rect.height / 2,
      };
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (locked) return;
    e.preventDefault();
    setIsDragging(true);
    updateImageBounds();
    const touch = e.touches[0];
    const rect = markerRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffsetRef.current = {
        x: touch.clientX - rect.left - rect.width / 2,
        y: touch.clientY - rect.top - rect.height / 2,
      };
    }
  };

  const containerToImagePercent = useCallback((pixelX: number, pixelY: number): { x: number; y: number } => {
    if (!imageBounds) return { x: 50, y: 50 };
    return {
      x: Math.max(0, Math.min(((pixelX - imageBounds.offsetX) / imageBounds.width) * 100, 100)),
      y: Math.max(0, Math.min(((pixelY - imageBounds.offsetY) / imageBounds.height) * 100, 100)),
    };
  }, [imageBounds]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !imageBounds) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const pixelX = e.clientX - containerRect.left - dragOffsetRef.current.x;
      const pixelY = e.clientY - containerRect.top - dragOffsetRef.current.y;
      setImagePercent(containerToImagePercent(pixelX, pixelY));
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!containerRef.current || !imageBounds) return;
      const touch = e.touches[0];
      const containerRect = containerRef.current.getBoundingClientRect();
      const pixelX = touch.clientX - containerRect.left - dragOffsetRef.current.x;
      const pixelY = touch.clientY - containerRect.top - dragOffsetRef.current.y;
      setImagePercent(containerToImagePercent(pixelX, pixelY));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsPlaced(true);
      onPositionChange(imagePercent.x, imagePercent.y);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      setIsPlaced(true);
      onPositionChange(imagePercent.x, imagePercent.y);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, imagePercent, containerRef, onPositionChange, imageBounds, containerToImagePercent]);

  const getContainerPosition = (): { left: string; top: string } => {
    if (!imageBounds || !containerRef.current) {
      return { left: `${imagePercent.x}%`, top: `${imagePercent.y}%` };
    }
    const containerRect = containerRef.current.getBoundingClientRect();
    const pixelX = imageBounds.offsetX + (imagePercent.x / 100) * imageBounds.width;
    const pixelY = imageBounds.offsetY + (imagePercent.y / 100) * imageBounds.height;
    return {
      left: `${(pixelX / containerRect.width) * 100}%`,
      top: `${(pixelY / containerRect.height) * 100}%`,
    };
  };

  const position = getContainerPosition();

  return (
    <div
      ref={markerRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className={cn(
        'absolute flex h-5 w-5 select-none items-center justify-center rounded-full border-[1.5px] border-marker-border bg-marker-bg font-display text-[10px] font-bold text-marker-text shadow-marker transition-transform',
        locked ? 'cursor-default' : 'cursor-grab',
        isDragging && 'cursor-grabbing scale-110 z-50',
        !isPlaced && 'animate-pulse-glow'
      )}
      style={{
        left: position.left,
        top: position.top,
        transform: 'translate(-50%, -50%)',
        zIndex: isDragging ? 1000 : 10,
      }}
    >
      {number}
    </div>
  );
}
