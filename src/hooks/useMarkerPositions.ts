/**
 * useMarkerPositions.ts
 *
 * Hotel selections are private to each visit: every time someone opens the
 * tool it starts with 0 hotels selected, and nothing they select is shared
 * with or visible to anyone else. Selections live only in this tab's memory.
 *
 * Canonical x,y pin positions live in Supabase table `hotel_positions` and are
 * loaded once on mount into a ref — they are immutable at runtime.
 * Hotels without a Supabase row fall back to `fallbackPosition` in hotels.ts.
 *
 * Pins are numbered in the order hotels were selected (1, 2, 3 …). Removing a
 * hotel moves the ones after it up by one, keeping their order.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { hotels } from '@/data/hotels';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarkerPosition {
  x: number;
  y: number;
}

export interface SelectedHotel {
  hotelId: string;
  number: number;
  position: MarkerPosition | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMarkerPositions() {
  const [selectedHotels, setSelectedHotels] = useState<SelectedHotel[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Permanent locked map of canonical hotel positions, loaded once on mount.
  const canonicalPositions = useRef<Record<string, MarkerPosition>>({});

  // ── Load canonical pin positions (selection always starts empty) ────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Local fallback positions first; Supabase rows (canonical) override them.
      const posMap: Record<string, MarkerPosition> = {};
      for (const hotel of hotels) {
        if (hotel.fallbackPosition) posMap[hotel.id] = { ...hotel.fallbackPosition };
      }
      try {
        const { data: posData, error: posError } = await supabase
          .from('hotel_positions')
          .select('hotel_id, x, y');
        if (posError) throw posError;
        for (const row of posData ?? []) {
          posMap[row.hotel_id] = { x: row.x, y: row.y };
        }
      } catch (err) {
        console.error('[useMarkerPositions] Failed to load pin positions from Supabase:', err);
      } finally {
        if (!cancelled) {
          canonicalPositions.current = posMap;
          setIsLoaded(true);
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── Select a hotel: it becomes the next number in click order ───────────────
  const selectHotel = useCallback((hotelId: string) => {
    const pos = canonicalPositions.current[hotelId];
    if (!pos) return;
    setSelectedHotels((prev) =>
      prev.some((h) => h.hotelId === hotelId)
        ? prev
        : [...prev, { hotelId, number: prev.length + 1, position: pos }]
    );
  }, []);

  // ── Deselect a hotel: later hotels move up, keeping their order ─────────────
  const deselectHotel = useCallback((hotelId: string) => {
    setSelectedHotels((prev) =>
      prev.filter((h) => h.hotelId !== hotelId).map((h, i) => ({ ...h, number: i + 1 }))
    );
  }, []);

  // ── Clear all selections ─────────────────────────────────────────────────────
  const clearAllSelections = useCallback(() => {
    setSelectedHotels([]);
  }, []);

  // ── Convenience helpers ───────────────────────────────────────────────────────
  const isHotelSelected = useCallback(
    (hotelId: string) => selectedHotels.some((h) => h.hotelId === hotelId),
    [selectedHotels]
  );

  const getHotelNumber = useCallback(
    (hotelId: string) => selectedHotels.find((h) => h.hotelId === hotelId)?.number ?? null,
    [selectedHotels]
  );

  return {
    selectedHotels,
    selectHotel,
    deselectHotel,
    clearAllSelections,
    isHotelSelected,
    getHotelNumber,
    isLoaded,
  };
}
