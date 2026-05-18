import { create } from 'zustand';
import type { Service, ExtraService, Slot } from '@/types';

export type WashType = 'manual' | 'robot';

interface BookingState {
  washType: WashType | null;
  selectedService: Service | null;
  selectedDate: Date | null;
  selectedSlot: Slot | null;
  selectedExtras: ExtraService[];
  carInfo: string;
  isSlotConflict: boolean;

  setWashType: (type: WashType) => void;
  setSelectedService: (service: Service | null) => void;
  setSelectedDate: (date: Date | null) => void;
  setSelectedSlot: (slot: Slot | null, conflict?: boolean) => void;
  toggleExtra: (extra: ExtraService) => void;
  setCarInfo: (info: string) => void;
  setSlotConflict: (v: boolean) => void;
  reset: () => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  washType: null,
  selectedService: null,
  selectedDate: null,
  selectedSlot: null,
  selectedExtras: [],
  carInfo: '',
  isSlotConflict: false,

  setWashType: (type) =>
    set({ washType: type, selectedService: null, selectedDate: null, selectedSlot: null, selectedExtras: [], isSlotConflict: false }),
  setSelectedService: (service) => set({ selectedService: service, selectedSlot: null, isSlotConflict: false }),
  setSelectedDate: (date) => set({ selectedDate: date, selectedSlot: null, isSlotConflict: false }),
  setSelectedSlot: (slot, conflict = false) => set({ selectedSlot: slot, isSlotConflict: conflict }),
  setSlotConflict: (v) => set({ isSlotConflict: v }),
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
      selectedDate: null,
      selectedSlot: null,
      selectedExtras: [],
      carInfo: '',
      isSlotConflict: false,
    }),
}));
