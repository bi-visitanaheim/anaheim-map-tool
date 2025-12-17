import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface DraggableMarkerProps {
  number: number;
  // Positions as percentages (0-100)
  percentX: number;
  percentY: number;
  onPositionChange: (percentX: number, percentY: number) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

export function DraggableMarker({
  number,
  percentX,
  percentY,
  onPositionChange,
  containerRef,
}: DraggableMarkerProps) {
  // Store position as percentages for display
  const [displayPercent, setDisplayPercent] = useState({ x: percentX, y: percentY });
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaced, setIsPlaced] = useState(percentX !== 0 || percentY !== 0);
  const markerRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Update display when props change (e.g., loading saved position)
  useEffect(() => {
    if (!isDragging) {
      setDisplayPercent({ x: percentX, y: percentY });
      if (percentX !== 0 || percentY !== 0) {
        setIsPlaced(true);
      }
    }
  }, [percentX, percentY, isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
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
    
    const touch = e.touches[0];
    const rect = markerRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffsetRef.current = {
        x: touch.clientX - rect.left - rect.width / 2,
        y: touch.clientY - rect.top - rect.height / 2,
      };
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const pixelX = e.clientX - containerRect.left - dragOffsetRef.current.x;
      const pixelY = e.clientY - containerRect.top - dragOffsetRef.current.y;
      
      // Convert to percentages and clamp to 0-100
      const newPercentX = Math.max(0, Math.min((pixelX / containerRect.width) * 100, 100));
      const newPercentY = Math.max(0, Math.min((pixelY / containerRect.height) * 100, 100));
      
      setDisplayPercent({ x: newPercentX, y: newPercentY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!containerRef.current) return;
      
      const touch = e.touches[0];
      const containerRect = containerRef.current.getBoundingClientRect();
      const pixelX = touch.clientX - containerRect.left - dragOffsetRef.current.x;
      const pixelY = touch.clientY - containerRect.top - dragOffsetRef.current.y;
      
      // Convert to percentages and clamp to 0-100
      const newPercentX = Math.max(0, Math.min((pixelX / containerRect.width) * 100, 100));
      const newPercentY = Math.max(0, Math.min((pixelY / containerRect.height) * 100, 100));
      
      setDisplayPercent({ x: newPercentX, y: newPercentY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsPlaced(true);
      // Notify parent with final percentage position
      onPositionChange(displayPercent.x, displayPercent.y);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      setIsPlaced(true);
      // Notify parent with final percentage position
      onPositionChange(displayPercent.x, displayPercent.y);
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
  }, [isDragging, displayPercent, containerRef, onPositionChange]);

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
        // Use CSS percentages for positioning - this scales automatically with container
        left: `${displayPercent.x}%`,
        top: `${displayPercent.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isDragging ? 1000 : 10,
      }}
    >
      {number}
    </div>
  );
}
