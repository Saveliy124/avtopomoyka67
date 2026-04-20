import { create } from 'zustand';
import type { Service, ExtraService, Box, Slot } from '@/types';

export type WashType = 'manual' | 'robot';

interface BookingState {
  washType: WashType | null;
  selectedService: Service | null;
  selectedBox: Box | null;
  selectedDate: Date | null;
  selectedSlot: Slot | null;
  selectedExtras: ExtraService[];
  carInfo: string;

  setWashType: (type: WashType) => void;
  setSelectedService: (service: Service | null) => void;
  setSelectedBox: (box: Box | null) => void;
  setSelectedDate: (date: Date | null) => void;
  setSelectedSlot: (slot: Slot | null) => void;
  toggleExtra: (extra: ExtraService) => void;
  setCarInfo: (info: string) => void;
  reset: () => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  washType: null,
  selectedService: null,
  selectedBox: null,
  selectedDate: null,
  selectedSlot: null,
  selectedExtras: [],
  carInfo: '',

  setWashType: (type) =>
    set({ washType: type, selectedService: null, selectedBox: null, selectedDate: null, selectedSlot: null, selectedExtras: [] }),
  setSelectedService: (service) => set({ selectedService: service }),
  setSelectedBox: (box) => set({ selectedBox: box, selectedSlot: null }),
  setSelectedDate: (date) => set({ selectedDate: date, selectedSlot: null }),
  setSelectedSlot: (slot) => set({ selectedSlot: slot }),
  toggleExtra: (extra) =>
    set((state) => {
      const exists = state.selectedExtras.find((e) => e.id === extra.id);
      return {
        selectedExtras: exists
          ? state.selectedExtras.filter((e) => e.id !== extra.id)
          : [...state.selectedExtras, extra],
      };
    }),
  setCarInfo: (info) => set({ carInfo: info }),
  reset: () =>
    set({
      washType: null,
      selectedService: null,
      selectedBox: null,
      selectedDate: null,
      selectedSlot: null,
      selectedExtras: [],
      carInfo: '',
    }),
}));
