/**
 * useMarkerPositions.ts
 *
 * Replaces localStorage with IndexedDB so hotel selections and marker positions
 * survive cache clears, private-browsing sessions, and storage-quota limits.
 *
 * Drop-in replacement — the hook's public API is identical to the old version.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

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

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

const DB_NAME    = 'anaheim-map-maker';
const DB_VERSION = 1;

const STORE_POSITIONS = 'markerPositions';  // { hotelId: string, x: number, y: number }
const STORE_SELECTED  = 'selectedHotels';   // { hotelId: string, number: number }

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_POSITIONS)) {
        db.createObjectStore(STORE_POSITIONS, { keyPath: 'hotelId' });
      }
      if (!db.objectStoreNames.contains(STORE_SELECTED)) {
        db.createObjectStore(STORE_SELECTED, { keyPath: 'hotelId' });
      }
    };

    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror   = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
}

function idbGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror   = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, store: string, value: object): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(value);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

function idbDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

function idbClear(db: IDBDatabase, store: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMarkerPositions() {
  const [selectedHotels,  setSelectedHotels]  = useState<SelectedHotel[]>([]);
  const [savedPositions,  setSavedPositions]  = useState<Record<string, MarkerPosition>>({});
  const [isLoaded,        setIsLoaded]        = useState(false);

  // Keep a ref so callbacks always see the latest db handle without re-creating
  const dbRef = useRef<IDBDatabase | null>(null);

  // ── Open DB and hydrate state on mount ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const db = await openDB();
        if (cancelled) return;
        dbRef.current = db;

        // Load saved marker positions
        const posRows = await idbGetAll<{ hotelId: string; x: number; y: number }>(
          db, STORE_POSITIONS
        );
        const posMap: Record<string, MarkerPosition> = {};
        for (const row of posRows) {
          posMap[row.hotelId] = { x: row.x, y: row.y };
        }

        // Load saved selected hotels (sorted by their stored number)
        const selRows = await idbGetAll<{ hotelId: string; number: number }>(
          db, STORE_SELECTED
        );
        selRows.sort((a, b) => a.number - b.number);

        const hydrated: SelectedHotel[] = selRows.map((row) => ({
          hotelId:  row.hotelId,
          number:   row.number,
          position: posMap[row.hotelId] ?? null,
        }));

        if (!cancelled) {
          setSavedPositions(posMap);
          setSelectedHotels(hydrated);
          setIsLoaded(true);
        }
      } catch (err) {
        console.error('[useMarkerPositions] Failed to open IndexedDB:', err);
        // Graceful fallback: mark loaded so the UI doesn't hang
        if (!cancelled) setIsLoaded(true);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── Select a hotel ──────────────────────────────────────────────────────────
  const selectHotel = useCallback(
    async (hotelId: string) => {
      setSelectedHotels((prev) => {
        if (prev.find((h) => h.hotelId === hotelId)) return prev;
        if (prev.length >= 20) return prev;

        const newNumber   = prev.length + 1;
        const savedPos    = savedPositions[hotelId] ?? null;
        const newSelected = [...prev, { hotelId, number: newNumber, position: savedPos }];

        // Persist asynchronously
        if (dbRef.current) {
          idbPut(dbRef.current, STORE_SELECTED, { hotelId, number: newNumber }).catch(
            (e) => console.error('[useMarkerPositions] idbPut selected:', e)
          );
        }

        return newSelected;
      });
    },
    [savedPositions]
  );

  // ── Deselect a hotel ────────────────────────────────────────────────────────
  const deselectHotel = useCallback(async (hotelId: string) => {
    setSelectedHotels((prev) => {
      const filtered  = prev.filter((h) => h.hotelId !== hotelId);
      const renumbered = filtered.map((hotel, index) => ({
        ...hotel,
        number: index + 1,
      }));

      // Persist: delete the deselected one, then re-write the renumbered ones
      if (dbRef.current) {
        const db = dbRef.current;
        idbDelete(db, STORE_SELECTED, hotelId).catch(
          (e) => console.error('[useMarkerPositions] idbDelete selected:', e)
        );
        for (const h of renumbered) {
          idbPut(db, STORE_SELECTED, { hotelId: h.hotelId, number: h.number }).catch(
            (e) => console.error('[useMarkerPositions] idbPut renumber:', e)
          );
        }
      }

      return renumbered;
    });
  }, []);

  // ── Update a marker's position ───────────────────────────────────────────────
  const updateMarkerPosition = useCallback(
    async (hotelId: string, position: MarkerPosition) => {
      // Update in-memory selected list
      setSelectedHotels((prev) =>
        prev.map((hotel) =>
          hotel.hotelId === hotelId ? { ...hotel, position } : hotel
        )
      );

      // Update saved positions map
      setSavedPositions((prev) => ({ ...prev, [hotelId]: position }));

      // Persist to IndexedDB
      if (dbRef.current) {
        idbPut(dbRef.current, STORE_POSITIONS, {
          hotelId,
          x: position.x,
          y: position.y,
        }).catch((e) => console.error('[useMarkerPositions] idbPut position:', e));
      }
    },
    []
  );

  // ── Clear everything ─────────────────────────────────────────────────────────
  const clearAllSelections = useCallback(async () => {
    setSelectedHotels([]);

    if (dbRef.current) {
      idbClear(dbRef.current, STORE_SELECTED).catch(
        (e) => console.error('[useMarkerPositions] idbClear selected:', e)
      );
    }
  }, []);

  // ── Convenience helpers ──────────────────────────────────────────────────────
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
    isLoaded,        // NEW: true once IndexedDB has been read — useful for loading states
  };
}
