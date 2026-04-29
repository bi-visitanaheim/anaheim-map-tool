/**
 * useMarkerPositions.ts
 *
 * Stores hotel selections and marker positions in Supabase so all users
 * share the same state in real time.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

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
  const [savedPositions, setSavedPositions] = useState<Record<string, MarkerPosition>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // ── Load all positions from Supabase on mount ────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('marker_positions')
          .select('hotel_id, x, y');

        if (error) throw error;
        if (cancelled) return;

        const posMap: Record<string, MarkerPosition> = {};
        for (const row of data ?? []) {
          posMap[row.hotel_id] = { x: row.x, y: row.y };
        }

        setSavedPositions(posMap);

        // Rebuild selectedHotels from positions that exist in DB
        // (positions are the source of truth — hotels with a position are "selected")
        const hydrated: SelectedHotel[] = Object.entries(posMap)
          .map(([hotelId, pos], idx) => ({
            hotelId,
            number: idx + 1,
            position: pos,
          }))
          .sort((a, b) => a.number - b.number);

        setSelectedHotels(hydrated);
      } catch (err) {
        console.error('[useMarkerPositions] Failed to load from Supabase:', err);
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── Select a hotel ───────────────────────────────────────────────────────────
  const selectHotel = useCallback(
    async (hotelId: string) => {
      setSelectedHotels((prev) => {
        if (prev.find((h) => h.hotelId === hotelId)) return prev;
        if (prev.length >= 20) return prev;

        const newNumber = prev.length + 1;
        const savedPos = savedPositions[hotelId] ?? null;
        return [...prev, { hotelId, number: newNumber, position: savedPos }];
      });
    },
    [savedPositions]
  );

  // ── Deselect a hotel ─────────────────────────────────────────────────────────
  const deselectHotel = useCallback(async (hotelId: string) => {
    // Remove from Supabase
    await supabase.from('marker_positions').delete().eq('hotel_id', hotelId);

    setSavedPositions((prev) => {
      const next = { ...prev };
      delete next[hotelId];
      return next;
    });

    setSelectedHotels((prev) => {
      const filtered = prev.filter((h) => h.hotelId !== hotelId);
      return filtered.map((hotel, index) => ({ ...hotel, number: index + 1 }));
    });
  }, []);

  // ── Update a marker's position ───────────────────────────────────────────────
  const updateMarkerPosition = useCallback(
    async (hotelId: string, position: MarkerPosition) => {
      // Upsert to Supabase
      const { error } = await supabase
        .from('marker_positions')
        .upsert({ hotel_id: hotelId, x: position.x, y: position.y }, { onConflict: 'hotel_id' });

      if (error) {
        console.error('[useMarkerPositions] Failed to upsert position:', error);
        return;
      }

      setSelectedHotels((prev) =>
        prev.map((hotel) =>
          hotel.hotelId === hotelId ? { ...hotel, position } : hotel
        )
      );

      setSavedPositions((prev) => ({ ...prev, [hotelId]: position }));
    },
    []
  );

  // ── Clear everything ──────────────────────────────────────────────────────────
  const clearAllSelections = useCallback(async () => {
    await supabase.from('marker_positions').delete().neq('hotel_id', '');
    setSelectedHotels([]);
    setSavedPositions({});
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
    updateMarkerPosition,
    clearAllSelections,
    isHotelSelected,
    getHotelNumber,
    savedPositions,
    isLoaded,
  };
}
