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
  // Positions as percentages of the IMAGE (0-100), not the container
  percentX: number;
  percentY: number;
  onPositionChange: (percentX: number, percentY: number) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  imageRef: React.RefObject<HTMLImageElement>;
}

// Calculate where the image actually displays within the container (due to object-contain)
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
    // Image is wider - fits to container width, has vertical letterboxing
    displayedWidth = containerWidth;
    displayedHeight = containerWidth / imageAspect;
    offsetX = 0;
    offsetY = (containerHeight - displayedHeight) / 2;
  } else {
    // Image is taller - fits to container height, has horizontal letterboxing
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
}: DraggableMarkerProps) {
  // Store position as percentages of the IMAGE for display
  const [imagePercent, setImagePercent] = useState({ x: percentX, y: percentY });
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaced, setIsPlaced] = useState(percentX !== 0 || percentY !== 0);
  const [imageBounds, setImageBounds] = useState<ImageBounds | null>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Calculate and update image bounds when container resizes
  const updateImageBounds = useCallback(() => {
    if (!containerRef.current || !imageRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const { naturalWidth, naturalHeight } = imageRef.current;
    
    if (naturalWidth === 0 || naturalHeight === 0) return;
    
    const bounds = getImageBounds(
      containerRect.width,
      containerRect.height,
      naturalWidth,
      naturalHeight
    );
    setImageBounds(bounds);
  }, [containerRef, imageRef]);

  // Update bounds on mount and resize
  useEffect(() => {
    updateImageBounds();
    
    const handleResize = () => updateImageBounds();
    window.addEventListener('resize', handleResize);
    
    // Also observe container size changes
    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [updateImageBounds, containerRef]);

  // Update display when props change (e.g., loading saved position)
  useEffect(() => {
    if (!isDragging) {
      setImagePercent({ x: percentX, y: percentY });
      if (percentX !== 0 || percentY !== 0) {
        setIsPlaced(true);
      }
    }
  }, [percentX, percentY, isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    updateImageBounds(); // Ensure we have fresh bounds
    
    const rect = markerRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffsetRef.current = {
        x: e.clientX - rect.left - rect.width / 2,
        y: e.clientY - rect.top - rect.height / 2,
      };
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    updateImageBounds(); // Ensure we have fresh bounds
    
    const touch = e.touches[0];
    const rect = markerRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffsetRef.current = {
        x: touch.clientX - rect.left - rect.width / 2,
        y: touch.clientY - rect.top - rect.height / 2,
      };
    }
  };

  // Convert container pixel position to image percentage
  const containerToImagePercent = useCallback((pixelX: number, pixelY: number): { x: number; y: number } => {
    if (!imageBounds) return { x: 50, y: 50 };
    
    // Convert container pixel to image percentage
    const imageX = ((pixelX - imageBounds.offsetX) / imageBounds.width) * 100;
    const imageY = ((pixelY - imageBounds.offsetY) / imageBounds.height) * 100;
    
    // Clamp to 0-100
    return {
      x: Math.max(0, Math.min(imageX, 100)),
      y: Math.max(0, Math.min(imageY, 100)),
    };
  }, [imageBounds]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !imageBounds) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const pixelX = e.clientX - containerRect.left - dragOffsetRef.current.x;
      const pixelY = e.clientY - containerRect.top - dragOffsetRef.current.y;
      
      const newPercent = containerToImagePercent(pixelX, pixelY);
      setImagePercent(newPercent);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!containerRef.current || !imageBounds) return;
      
      const touch = e.touches[0];
      const containerRect = containerRef.current.getBoundingClientRect();
      const pixelX = touch.clientX - containerRect.left - dragOffsetRef.current.x;
      const pixelY = touch.clientY - containerRect.top - dragOffsetRef.current.y;
      
      const newPercent = containerToImagePercent(pixelX, pixelY);
      setImagePercent(newPercent);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsPlaced(true);
      // Notify parent with final IMAGE percentage position
      onPositionChange(imagePercent.x, imagePercent.y);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      setIsPlaced(true);
      // Notify parent with final IMAGE percentage position
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

  // Convert image percentage to container pixel position for rendering
  const getContainerPosition = (): { left: string; top: string } => {
    if (!imageBounds || !containerRef.current) {
      // Fallback: use container percentage (will be slightly off but better than nothing)
      return { left: `${imagePercent.x}%`, top: `${imagePercent.y}%` };
    }
    
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // Convert image percentage to pixel position within container
    const pixelX = imageBounds.offsetX + (imagePercent.x / 100) * imageBounds.width;
    const pixelY = imageBounds.offsetY + (imagePercent.y / 100) * imageBounds.height;
    
    // Convert to container percentage for CSS
    const containerPercentX = (pixelX / containerRect.width) * 100;
    const containerPercentY = (pixelY / containerRect.height) * 100;
    
    return {
      left: `${containerPercentX}%`,
      top: `${containerPercentY}%`,
    };
  };

  const position = getContainerPosition();

  return (
    <div
      ref={markerRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className={cn(
        "absolute flex h-5 w-5 cursor-grab select-none items-center justify-center rounded-full border-[1.5px] border-marker-border bg-marker-bg font-display text-[10px] font-bold text-marker-text shadow-marker transition-transform",
        isDragging && "cursor-grabbing scale-110 z-50",
        !isPlaced && "animate-pulse-glow"
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
