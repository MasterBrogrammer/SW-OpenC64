export type C64Module = {
  HEAPU8: Uint8Array;
  HEAPF32: Float32Array;
  ccall: (
    ident: string,
    returnType: string | null,
    argTypes: string[],
    args: unknown[],
  ) => unknown;
  _malloc: (n: number) => number;
  _free: (p: number) => void;
  _c64_init: () => void;
  _c64_reset: () => void;
  _c64_update: () => void;
  _c64_setModel: (n: number) => void;
  _c64_getPixelBuffer: () => number;
  _c64_insertDisk: (ptr: number, len: number) => void;
  _c64_loadPRG: (ptr: number, len: number, inject: number) => void;
  _c64_loadCartridge: (ptr: number, len: number) => void;
  _c64_removeCartridge: () => void;
  _c64_setDriveEnabled: (on: number) => void;
  _c64_joystick_push: (port: number, mask: number) => void;
  _c64_joystick_release: (port: number, mask: number) => void;
  _c64_ramRead: (addr: number) => number;
  _c64_ramWrite: (addr: number, value: number) => void;
  _c64_cpuRead: (addr: number) => number;
  _c64_cpuWrite: (addr: number, value: number) => void;
  _c64_getPC: () => number;
  _keyboard_keyPressed: (index: number) => void;
  _keyboard_keyReleased: (index: number) => void;
  _c1541_getStatus: () => number;
  _sid_setSampleRate: (rate: number) => number;
  _sid_getAudioBuffer: () => number;
  _sid_setModel: (model: number) => void;
  _debugger_pause: () => void;
  _debugger_play: () => void;
  _debugger_isRunning: () => number;
  _debugger_update: (dt: number) => number;
};
