import { create } from 'zustand';

interface UiState {
  isBookingModalOpen: boolean;
  isLoading: boolean;
  setBookingModalOpen: (open: boolean) => void;
  setLoading: (loading: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isBookingModalOpen: false,
  isLoading: false,
  setBookingModalOpen: (open) => set({ isBookingModalOpen: open }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
