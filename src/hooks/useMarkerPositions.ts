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

// Staggered default positions so new markers don't pile up on each other
const DEFAULT_POSITIONS: MarkerPosition[] = [
  { x: 45, y: 45 }, { x: 50, y: 45 }, { x: 55, y: 45 },
  { x: 45, y: 50 }, { x: 50, y: 50 }, { x: 55, y: 50 },
  { x: 45, y: 55 }, { x: 50, y: 55 }, { x: 55, y: 55 },
  { x: 40, y: 45 }, { x: 60, y: 45 }, { x: 40, y: 50 },
  { x: 60, y: 50 }, { x: 40, y: 55 }, { x: 60, y: 55 },
  { x: 45, y: 40 }, { x: 50, y: 40 }, { x: 55, y: 40 },
  { x: 45, y: 60 }, { x: 50, y: 60 },
];

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
          .select('hotel_id, x, y, number')
          .order('number', { ascending: true });

        if (error) throw error;
        if (cancelled) return;

        const posMap: Record<string, MarkerPosition> = {};
        for (const row of data ?? []) {
          posMap[row.hotel_id] = { x: row.x, y: row.y };
        }

        setSavedPositions(posMap);

        const hydrated: SelectedHotel[] = (data ?? []).map((row) => ({
          hotelId: row.hotel_id,
          number: row.number,
          position: { x: row.x, y: row.y },
        }));

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
        // Use saved position if it exists, otherwise pick a staggered default
        const savedPos = savedPositions[hotelId] ?? DEFAULT_POSITIONS[(newNumber - 1) % DEFAULT_POSITIONS.length];
        const newEntry: SelectedHotel = { hotelId, number: newNumber, position: savedPos };

        // Immediately persist to Supabase (fire and forget)
        supabase
          .from('marker_positions')
          .upsert(
            { hotel_id: hotelId, x: savedPos.x, y: savedPos.y, number: newNumber },
            { onConflict: 'hotel_id' }
          )
          .then(({ error }) => {
            if (error) console.error('[useMarkerPositions] Failed to persist selection:', error);
          });

        return [...prev, newEntry];
      });
    },
    [savedPositions]
  );

  // ── Deselect a hotel ─────────────────────────────────────────────────────────
  const deselectHotel = useCallback(async (hotelId: string) => {
    await supabase.from('marker_positions').delete().eq('hotel_id', hotelId);

    setSavedPositions((prev) => {
      const next = { ...prev };
      delete next[hotelId];
      return next;
    });

    setSelectedHotels((prev) => {
      const filtered = prev.filter((h) => h.hotelId !== hotelId);
      const renumbered = filtered.map((hotel, index) => ({ ...hotel, number: index + 1 }));

      // Re-persist updated numbers
      renumbered.forEach(({ hotelId: hid, number, position }) => {
        if (!position) return;
        supabase
          .from('marker_positions')
          .upsert({ hotel_id: hid, x: position.x, y: position.y, number }, { onConflict: 'hotel_id' })
          .then(({ error }) => {
            if (error) console.error('[useMarkerPositions] Failed to renumber:', error);
          });
      });

      return renumbered;
    });
  }, []);

  // ── Update a marker's position ───────────────────────────────────────────────
  const updateMarkerPosition = useCallback(
    async (hotelId: string, position: MarkerPosition) => {
      const number = selectedHotels.find((h) => h.hotelId === hotelId)?.number ?? 1;

      const { error } = await supabase
        .from('marker_positions')
        .upsert(
          { hotel_id: hotelId, x: position.x, y: position.y, number },
          { onConflict: 'hotel_id' }
        );

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
    [selectedHotels]
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
