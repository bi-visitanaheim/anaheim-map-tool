import { useState, useEffect, useCallback } from 'react';

export interface MarkerPosition {
  x: number;
  y: number;
}

export interface SelectedHotel {
  hotelId: string;
  number: number;
  position: MarkerPosition | null;
}

const STORAGE_KEY = 'anaheim-hotel-marker-positions';

export function useMarkerPositions() {
  const [selectedHotels, setSelectedHotels] = useState<SelectedHotel[]>([]);
  const [savedPositions, setSavedPositions] = useState<Record<string, MarkerPosition>>({});

  // Load saved positions from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSavedPositions(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading saved positions:', error);
    }
  }, []);

  // Save positions to localStorage whenever they change
  const savePositions = useCallback((positions: Record<string, MarkerPosition>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
      setSavedPositions(positions);
    } catch (error) {
      console.error('Error saving positions:', error);
    }
  }, []);

  const selectHotel = useCallback((hotelId: string) => {
    setSelectedHotels(prev => {
      // Check if already selected
      if (prev.find(h => h.hotelId === hotelId)) {
        return prev;
      }

      // Max 20 hotels
      if (prev.length >= 20) {
        return prev;
      }

      const newNumber = prev.length + 1;
      const savedPosition = savedPositions[hotelId] || null;

      return [...prev, { hotelId, number: newNumber, position: savedPosition }];
    });
  }, [savedPositions]);

  const deselectHotel = useCallback((hotelId: string) => {
    setSelectedHotels(prev => {
      const filtered = prev.filter(h => h.hotelId !== hotelId);
      // Renumber remaining hotels
      return filtered.map((hotel, index) => ({
        ...hotel,
        number: index + 1,
      }));
    });
  }, []);

  const updateMarkerPosition = useCallback((hotelId: string, position: MarkerPosition) => {
    // Update in selected hotels
    setSelectedHotels(prev =>
      prev.map(hotel =>
        hotel.hotelId === hotelId ? { ...hotel, position } : hotel
      )
    );

    // Save to persistent storage
    const newPositions = { ...savedPositions, [hotelId]: position };
    savePositions(newPositions);
  }, [savedPositions, savePositions]);

  const clearAllSelections = useCallback(() => {
    setSelectedHotels([]);
  }, []);

  const isHotelSelected = useCallback((hotelId: string) => {
    return selectedHotels.some(h => h.hotelId === hotelId);
  }, [selectedHotels]);

  const getHotelNumber = useCallback((hotelId: string) => {
    const hotel = selectedHotels.find(h => h.hotelId === hotelId);
    return hotel?.number || null;
  }, [selectedHotels]);

  return {
    selectedHotels,
    selectHotel,
    deselectHotel,
    updateMarkerPosition,
    clearAllSelections,
    isHotelSelected,
    getHotelNumber,
    savedPositions,
  };
}
