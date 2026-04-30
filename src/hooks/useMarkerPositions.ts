/**
 * useMarkerPositions.ts
 *
 * Hotel selections live in Supabase table `selected_hotels`.
 * Canonical x,y positions live in Supabase table `hotel_positions` and are
 * loaded once on mount into a ref — they are immutable at runtime.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [isLoaded, setIsLoaded] = useState(false);

  // Permanent locked map of canonical hotel positions, loaded once on mount.
  const canonicalPositions = useRef<Record<string, MarkerPosition>>({});

  // ── Load canonical positions, then hydrate active selections ────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: posData, error: posError } = await supabase
          .from('hotel_positions')
          .select('hotel_id, x, y');

        if (posError) throw posError;
        if (cancelled) return;

        const posMap: Record<string, MarkerPosition> = {};
        for (const row of posData ?? []) {
          posMap[row.hotel_id] = { x: row.x, y: row.y };
        }
        canonicalPositions.current = posMap;

        const { data: selData, error: selError } = await supabase
          .from('selected_hotels')
          .select('hotel_id, number')
          .order('number', { ascending: true });

        if (selError) throw selError;
        if (cancelled) return;

        const hydrated: SelectedHotel[] = (selData ?? []).map((row) => ({
          hotelId: row.hotel_id,
          number: row.number,
          position: posMap[row.hotel_id] ?? null,
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
  const selectHotel = useCallback(async (hotelId: string) => {
    let added: SelectedHotel | null = null;

    setSelectedHotels((prev) => {
      if (prev.find((h) => h.hotelId === hotelId)) return prev;

      const pos = canonicalPositions.current[hotelId];
      if (!pos) return prev;

      const newNumber = prev.length + 1;
      added = { hotelId, number: newNumber, position: pos };
      return [...prev, added];
    });

    if (!added) return;

    const { error } = await supabase
      .from('selected_hotels')
      .upsert(
        { hotel_id: added.hotelId, number: added.number },
        { onConflict: 'hotel_id' }
      );
    if (error) console.error('[useMarkerPositions] Failed to persist selection:', error);
  }, []);

  // ── Deselect a hotel ─────────────────────────────────────────────────────────
  const deselectHotel = useCallback(async (hotelId: string) => {
    let renumbered: SelectedHotel[] = [];

    setSelectedHotels((prev) => {
      const filtered = prev.filter((h) => h.hotelId !== hotelId);
      renumbered = filtered.map((hotel, index) => ({ ...hotel, number: index + 1 }));
      return renumbered;
    });

    const { error: delError } = await supabase
      .from('selected_hotels')
      .delete()
      .eq('hotel_id', hotelId);
    if (delError) console.error('[useMarkerPositions] Failed to delete selection:', delError);

    if (renumbered.length > 0) {
      const { error: upError } = await supabase
        .from('selected_hotels')
        .upsert(
          renumbered.map(({ hotelId: hid, number }) => ({ hotel_id: hid, number })),
          { onConflict: 'hotel_id' }
        );
      if (upError) console.error('[useMarkerPositions] Failed to renumber:', upError);
    }
  }, []);

  // ── Clear all selections ─────────────────────────────────────────────────────
  const clearAllSelections = useCallback(async () => {
    setSelectedHotels([]);
    const { error } = await supabase
      .from('selected_hotels')
      .delete()
      .neq('hotel_id', '');
    if (error) console.error('[useMarkerPositions] Failed to clear selections:', error);
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
