export {};

declare global {
  type MomentumIdleDeadline = {
    didTimeout: boolean;
    timeRemaining: () => number;
  };

  interface Window {
    requestIdleCallback?: (
      callback: (deadline: MomentumIdleDeadline) => void,
      options?: { timeout?: number },
    ) => number;
    cancelIdleCallback?: (handle: number) => void;

    webkitAudioContext?: typeof AudioContext;

    __realTimeSync?: unknown;
    migrateTimerData?: unknown;
  }

  interface Navigator {
    deviceMemory?: number;
    getBattery?: () => Promise<BatteryManager>;
  }

  interface BatteryManager extends EventTarget {
    readonly charging?: boolean;
    readonly chargingTime?: number;
    readonly dischargingTime?: number;
    readonly level: number;
  }

  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }

  interface LayoutShiftAttribution {
    readonly node?: Node;
    readonly previousRect: DOMRectReadOnly;
    readonly currentRect: DOMRectReadOnly;
  }

  interface LayoutShift extends PerformanceEntry {
    readonly value: number;
    readonly hadRecentInput: boolean;
    readonly lastInputTime?: number;
    readonly sources: LayoutShiftAttribution[];
  }
}
