import { create } from "zustand";

type Pending = { id: string; nonce: number };

export type BootPhase = "off" | "loading" | "booting" | "running" | "error";

type EmuState = {
  loadedId: string | null;
  loadingId: string | null;
  pendingLoad: Pending | null;
  loadError: string | null;
  drive1On: boolean;
  drive1Name: string;
  paused: boolean;
  color: boolean;
  scanlines: boolean;
  invert: boolean;
  muted: boolean;
  volume: number;
  emuSpeed: number;
  focused: boolean;
  joystick: boolean;
  status: string;
  booted: boolean;
  bootPhase: BootPhase;
  mcpLive: boolean;
  uplinkLive: boolean;
  diskDirty: boolean;
  nonce: number;
  requestLoad: (id: string) => void;
  requestEject: () => void;
  clearPending: () => void;
  setLoaded: (id: string | null, driveName: string) => void;
  setLoading: (id: string | null) => void;
  setLoadError: (error: string | null) => void;
  setDrive: (on: boolean) => void;
  setDriveName: (name: string) => void;
  setPaused: (paused: boolean) => void;
  setColor: (color: boolean) => void;
  setScanlines: (scanlines: boolean) => void;
  setInvert: (invert: boolean) => void;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  setEmuSpeed: (emuSpeed: number) => void;
  setFocused: (focused: boolean) => void;
  setJoystick: (joystick: boolean) => void;
  setStatus: (status: string) => void;
  setBooted: (booted: boolean) => void;
  setBootPhase: (phase: BootPhase) => void;
  beginMcp: () => void;
  endMcp: () => void;
  beginUplink: () => void;
  endUplink: () => void;
  setDiskDirty: (dirty: boolean) => void;
};

export const useEmu = create<EmuState>((set) => ({
  loadedId: null,
  loadingId: null,
  pendingLoad: null,
  loadError: null,
  drive1On: false,
  drive1Name: "Empty",
  paused: false,
  color: true,
  scanlines: true,
  invert: false,
  muted: false,
  volume: 50,
  emuSpeed: 25,
  focused: false,
  joystick: false,
  status: "Powering on…",
  booted: false,
  bootPhase: "off",
  mcpLive: false,
  uplinkLive: false,
  diskDirty: false,
  nonce: 0,
  requestLoad: (id) =>
    set((s) => ({
      pendingLoad: { id, nonce: s.nonce + 1 },
      nonce: s.nonce + 1,
      loadError: null,
    })),
  requestEject: () =>
    set((s) => ({
      pendingLoad: { id: "basic", nonce: s.nonce + 1 },
      nonce: s.nonce + 1,
      loadError: null,
    })),
  clearPending: () => set({ pendingLoad: null }),
  setLoaded: (id, driveName) =>
    set({
      loadedId: id,
      drive1Name: driveName,
      pendingLoad: null,
      loadingId: null,
      loadError: null,
      diskDirty: false,
    }),
  setLoading: (id) => set({ loadingId: id }),
  setLoadError: (error) => set({ loadError: error, loadingId: null }),
  setDrive: (on) => set({ drive1On: on }),
  setDriveName: (name) => set({ drive1Name: name }),
  setPaused: (paused) => set({ paused }),
  setColor: (color) => set({ color }),
  setScanlines: (scanlines) => set({ scanlines }),
  setInvert: (invert) => set({ invert }),
  setMuted: (muted) => set({ muted }),
  setVolume: (volume) => set({ volume: Math.min(100, Math.max(0, volume)) }),
  setEmuSpeed: (emuSpeed) =>
    set({ emuSpeed: Math.min(100, Math.max(10, Math.round(emuSpeed))) }),
  setFocused: (focused) => set({ focused }),
  setJoystick: (joystick) => set({ joystick }),
  setStatus: (status) => set({ status }),
  setBooted: (booted) => set({ booted }),
  setBootPhase: (bootPhase) => set({ bootPhase }),
  beginMcp: () => set({ mcpLive: true }),
  endMcp: () => set({ mcpLive: false }),
  beginUplink: () => set({ uplinkLive: true }),
  endUplink: () => set({ uplinkLive: false }),
  setDiskDirty: (diskDirty) => set({ diskDirty }),
}));
