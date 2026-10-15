/**
 * useMarkerPositions.ts
 *
 * Hotel selections live in Supabase table `selected_hotels`.
 * Canonical x,y positions live in Supabase table `hotel_positions` and are
 * loaded once on mount into a ref — they are immutable at runtime.
 * Hotels without a Supabase row fall back to `fallbackPosition` in hotels.ts.
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

  // ── Sync with the shared database and keep numbering gap-free ───────────────
  // Selections are shared by everyone using the tool, so the database (not this
  // browser) is the source of truth for numbering. After every change we
  // re-read the table, renumber 1..N in the stored order (ties broken by hotel
  // id so every browser computes the same result), write back any numbers that
  // changed, and display the result. Concurrent edits from two people therefore
  // converge on the same gap-free, duplicate-free numbering.
  const syncInFlight = useRef<Promise<void> | null>(null);
  const selectedRef = useRef<SelectedHotel[]>([]);
  useEffect(() => {
    selectedRef.current = selectedHotels;
  }, [selectedHotels]);

  const syncFromDatabase = useCallback(async (): Promise<void> => {
    // Coalesce overlapping syncs so rapid clicks don't race each other.
    if (syncInFlight.current) {
      await syncInFlight.current;
    }
    const run = (async () => {
      const { data, error } = await supabase
        .from('selected_hotels')
        .select('hotel_id, number')
        .order('number', { ascending: true })
        .order('hotel_id', { ascending: true });
      if (error) {
        console.error('[useMarkerPositions] Failed to read selections:', error);
        return;
      }

      const rows = data ?? [];
      const renumbered = rows.map((row, index) => ({ hotel_id: row.hotel_id as string, number: index + 1, old: row.number as number }));
      const changed = renumbered.filter((r) => r.old !== r.number).map(({ hotel_id, number }) => ({ hotel_id, number }));
      if (changed.length > 0) {
        const { error: upError } = await supabase
          .from('selected_hotels')
          .upsert(changed, { onConflict: 'hotel_id' });
        if (upError) console.error('[useMarkerPositions] Failed to renumber:', upError);
      }

      setSelectedHotels(
        renumbered.map(({ hotel_id, number }) => ({
          hotelId: hotel_id,
          number,
          position: canonicalPositions.current[hotel_id] ?? null,
        }))
      );
    })();
    syncInFlight.current = run;
    try {
      await run;
    } finally {
      if (syncInFlight.current === run) syncInFlight.current = null;
    }
  }, []);

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

        // Seed with local fallback positions for hotels that don't have a
        // Supabase row yet; Supabase rows (canonical) override them below.
        const posMap: Record<string, MarkerPosition> = {};
        for (const hotel of hotels) {
          if (hotel.fallbackPosition) posMap[hotel.id] = { ...hotel.fallbackPosition };
        }
        for (const row of posData ?? []) {
          posMap[row.hotel_id] = { x: row.x, y: row.y };
        }
        canonicalPositions.current = posMap;

        // Also repairs any existing gaps/duplicates in the shared numbering.
        await syncFromDatabase();
      } catch (err) {
        console.error('[useMarkerPositions] Failed to load from Supabase:', err);
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    })();

    return () => { cancelled = true; };
  }, [syncFromDatabase]);

  // ── Pick up teammates' changes when this tab regains focus ──────────────────
  useEffect(() => {
    if (!isLoaded) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void syncFromDatabase();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [isLoaded, syncFromDatabase]);

  // ── Select a hotel ───────────────────────────────────────────────────────────
  const selectHotel = useCallback(async (hotelId: string) => {
    const pos = canonicalPositions.current[hotelId];
    if (!pos) return;

    if (selectedRef.current.some((h) => h.hotelId === hotelId)) return;

    // Optimistic update so the click feels instant.
    setSelectedHotels((prev) =>
      prev.some((h) => h.hotelId === hotelId)
        ? prev
        : [...prev, { hotelId, number: prev.length + 1, position: pos }]
    );

    // Append after the highest number currently in the database (not this
    // browser's count, which may be stale), then let the sync renumber.
    const { data: maxRow, error: maxError } = await supabase
      .from('selected_hotels')
      .select('number')
      .order('number', { ascending: false })
      .limit(1);
    if (maxError) console.error('[useMarkerPositions] Failed to read max number:', maxError);
    const nextNumber = ((maxRow?.[0]?.number as number | undefined) ?? 0) + 1;

    const { error } = await supabase
      .from('selected_hotels')
      .upsert({ hotel_id: hotelId, number: nextNumber }, { onConflict: 'hotel_id', ignoreDuplicates: true });
    if (error) console.error('[useMarkerPositions] Failed to persist selection:', error);

    await syncFromDatabase();
  }, [syncFromDatabase]);

  // ── Deselect a hotel ─────────────────────────────────────────────────────────
  const deselectHotel = useCallback(async (hotelId: string) => {
    // Optimistic update
    setSelectedHotels((prev) =>
      prev.filter((h) => h.hotelId !== hotelId).map((h, i) => ({ ...h, number: i + 1 }))
    );

    const { error: delError } = await supabase
      .from('selected_hotels')
      .delete()
      .eq('hotel_id', hotelId);
    if (delError) console.error('[useMarkerPositions] Failed to delete selection:', delError);

    await syncFromDatabase();
  }, [syncFromDatabase]);

  // ── Clear all selections ─────────────────────────────────────────────────────
  const clearAllSelections = useCallback(async () => {
    setSelectedHotels([]);
    const { error } = await supabase
      .from('selected_hotels')
      .delete()
      .neq('hotel_id', '');
    if (error) console.error('[useMarkerPositions] Failed to clear selections:', error);
    await syncFromDatabase();
  }, [syncFromDatabase]);

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
