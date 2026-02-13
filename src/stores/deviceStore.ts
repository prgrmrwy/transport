import { create } from "zustand";
import { Device } from "../types";

interface DeviceStore {
  devices: Device[];
  localDevice: Device | null;
  selectedDevice: Device | null;
  setDevices: (devices: Device[]) => void;
  setLocalDevice: (device: Device) => void;
  selectDevice: (device: Device | null) => void;
}

export const useDeviceStore = create<DeviceStore>((set) => ({
  devices: [],
  localDevice: null,
  selectedDevice: null,
  setDevices: (devices) => set({ devices }),
  setLocalDevice: (device) =>
    set((state) => ({
      localDevice: device,
      selectedDevice: state.selectedDevice ?? device,
    })),
  selectDevice: (device) => set({ selectedDevice: device }),
}));
