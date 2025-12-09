import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface DraggableMarkerProps {
  number: number;
  initialX: number;
  initialY: number;
  onPositionChange: (x: number, y: number) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

export function DraggableMarker({
  number,
  initialX,
  initialY,
  onPositionChange,
  containerRef,
}: DraggableMarkerProps) {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaced, setIsPlaced] = useState(initialX !== 0 || initialY !== 0);
  const markerRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (initialX !== 0 || initialY !== 0) {
      setPosition({ x: initialX, y: initialY });
      setIsPlaced(true);
    }
  }, [initialX, initialY]);

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
      const x = e.clientX - containerRect.left - dragOffsetRef.current.x;
      const y = e.clientY - containerRect.top - dragOffsetRef.current.y;
      
      // Clamp to container bounds
      const clampedX = Math.max(0, Math.min(x, containerRect.width));
      const clampedY = Math.max(0, Math.min(y, containerRect.height));
      
      setPosition({ x: clampedX, y: clampedY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!containerRef.current) return;
      
      const touch = e.touches[0];
      const containerRect = containerRef.current.getBoundingClientRect();
      const x = touch.clientX - containerRect.left - dragOffsetRef.current.x;
      const y = touch.clientY - containerRect.top - dragOffsetRef.current.y;
      
      const clampedX = Math.max(0, Math.min(x, containerRect.width));
      const clampedY = Math.max(0, Math.min(y, containerRect.height));
      
      setPosition({ x: clampedX, y: clampedY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsPlaced(true);
      onPositionChange(position.x, position.y);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      setIsPlaced(true);
      onPositionChange(position.x, position.y);
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
  }, [isDragging, position, containerRef, onPositionChange]);

  return (
    <div
      ref={markerRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className={cn(
        "absolute flex h-7 w-7 cursor-grab select-none items-center justify-center rounded-full border-2 border-marker-border bg-marker-bg font-display text-sm font-bold text-marker-text shadow-marker transition-transform",
        isDragging && "cursor-grabbing scale-110 z-50",
        !isPlaced && "animate-pulse-glow"
      )}
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
        zIndex: isDragging ? 1000 : 10,
      }}
    >
      {number}
    </div>
  );
}
