/**
 * The yard's time-of-day lighting preference.
 *
 * Purely cosmetic: it selects one of the four palettes in design/tokens.ts
 * and touches nothing the engine, the scoring, or the level data can see.
 * Persisted exactly the way SoundManager persists its mute flag — a single
 * AsyncStorage key, an in-memory value that is correct from the first frame
 * (falling back to the default until the read resolves), and a listener set
 * so every mounted board and the settings screen stay in sync.
 *
 * Extended (design_handoff_menus/README.md §2) with an `'auto'` preference
 * that follows the device's real clock: the default for new installs, and
 * the mode the menu re-skin's "Hora Dorada" badge advertises. A previously
 * persisted plain `TimeOfDay` (from before this mode existed) still loads as
 * that manual override — see `isTimeOfDaySetting`.
 */

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppStateStatus } from 'react-native';

import {
  getTimeOfDayPalette,
  timeOfDayOrder,
  type TimeOfDay,
  type TimeOfDayPalette,
} from '../../../design/tokens';

const STORAGE_KEY = 'train_time_of_day';

/** The stored/settable preference — a pinned pass, or 'auto' to follow the clock. */
export type TimeOfDaySetting = TimeOfDay | 'auto';

/**
 * Franjas horarias (hora local del dispositivo) — see
 * design_handoff_menus/README.md §2's table. Boundaries are half-open
 * (`>= start && < end`) so 05:00:00.000 exactly is already `amanecer` and
 * 08:00:00.000 exactly is already `mediodia`.
 */
export function resolveAutoTimeOfDay(date: Date = new Date()): TimeOfDay {
  const h = date.getHours();
  if (h >= 5 && h < 8) return 'amanecer';
  if (h >= 8 && h < 17) return 'mediodia';
  if (h >= 17 && h < 20) return 'atardecer';
  return 'noche';
}

function isTimeOfDay(value: unknown): value is TimeOfDay {
  return typeof value === 'string' && (timeOfDayOrder as readonly string[]).includes(value);
}

function isTimeOfDaySetting(value: unknown): value is TimeOfDaySetting {
  return value === 'auto' || isTimeOfDay(value);
}

// Default preference is 'auto'; currentResolved is computed eagerly from the
// real clock so the very first frame (before AsyncStorage.getItem resolves)
// already shows the correct pass instead of a hardcoded fallback.
let currentSetting: TimeOfDaySetting = 'auto';
let currentResolved: TimeOfDay = resolveAutoTimeOfDay();
let initPromise: Promise<void> | null = null;
const listeners = new Set<(setting: TimeOfDaySetting) => void>();

function notify(): void {
  for (const l of listeners) {
    try {
      l(currentSetting);
    } catch {
      // one bad listener must not break the others
    }
  }
}

/** Re-derives currentResolved from currentSetting. Returns true if it changed. */
function recomputeResolved(): boolean {
  const next = currentSetting === 'auto' ? resolveAutoTimeOfDay() : currentSetting;
  if (next !== currentResolved) {
    currentResolved = next;
    return true;
  }
  return false;
}

/** Safe to call repeatedly; never rejects. */
function init(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      // A pre-'auto' install stored a plain TimeOfDay here — isTimeOfDaySetting
      // accepts that as-is, so it keeps loading as that manual override.
      if (isTimeOfDaySetting(stored)) currentSetting = stored;
    } catch {
      currentSetting = 'auto';
    }
    recomputeResolved();
    notify();
  })().catch(() => {
    // init() itself must never reject.
  });
  return initPromise;
}

/** Raw preference — may be 'auto'. Use `getResolved()` to draw with. */
function get(): TimeOfDaySetting {
  return currentSetting;
}

/** The palette pass to actually draw — 'auto' already resolved against the clock. */
function getResolved(): TimeOfDay {
  return currentResolved;
}

async function set(value: TimeOfDaySetting): Promise<void> {
  if (!isTimeOfDaySetting(value) || value === currentSetting) return;
  currentSetting = value;
  recomputeResolved();
  notify();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Best-effort persistence — the in-memory value still applies this session.
  }
}

function onChange(listener: (setting: TimeOfDaySetting) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Re-evaluates 'auto' against the clock; no-op (and no notify) otherwise or if unchanged. */
function refreshAuto(): void {
  if (currentSetting !== 'auto') return;
  if (recomputeResolved()) notify();
}

// ─────────────────────────────────────────────────────────────────────────
// Foreground auto-refresh: while any component is subscribed (via
// useTimeOfDay/useTimeOfDaySetting below), re-check the clock on an AppState
// 'active' transition and on a ~60s interval, so a long-lived foreground
// session crosses a franja without needing to reopen the app. Refcounted
// across every mounted consumer so there's ever only one interval/listener
// alive, and both are torn down the moment the last consumer unmounts (no
// timers ticking in the background).
//
// `react-native`'s AppState is required LAZILY (not statically imported):
// this module is also loaded by Jest's plain Node test environment (see
// __tests__/timeOfDay.test.ts, which only exercises resolveAutoTimeOfDay's
// pure clock math) that has no react-native/Metro transform for that
// package's untranspiled entry file. Deferring the require means it's only
// ever touched by a real mounted component, never at module-import time.
// ─────────────────────────────────────────────────────────────────────────

interface MinimalAppState {
  addEventListener(type: 'change', listener: (status: AppStateStatus) => void): { remove(): void };
}

let appStateModule: MinimalAppState | null | undefined;

function loadAppState(): MinimalAppState | null {
  if (appStateModule === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      appStateModule = (require('react-native') as { AppState: MinimalAppState }).AppState;
    } catch {
      appStateModule = null;
    }
  }
  return appStateModule;
}

let autoWatchRefCount = 0;
let appStateSubscription: { remove(): void } | null = null;
let autoWatchIntervalId: ReturnType<typeof setInterval> | null = null;

const AUTO_WATCH_INTERVAL_MS = 60_000;

function startAutoWatch(): void {
  autoWatchRefCount += 1;
  if (autoWatchRefCount > 1) return;
  const AppState = loadAppState();
  if (AppState) {
    appStateSubscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') refreshAuto();
    });
  }
  autoWatchIntervalId = setInterval(refreshAuto, AUTO_WATCH_INTERVAL_MS);
}

function stopAutoWatch(): void {
  autoWatchRefCount = Math.max(0, autoWatchRefCount - 1);
  if (autoWatchRefCount > 0) return;
  appStateSubscription?.remove();
  appStateSubscription = null;
  if (autoWatchIntervalId != null) clearInterval(autoWatchIntervalId);
  autoWatchIntervalId = null;
}

export const TimeOfDayManager = { init, get, getResolved, set, onChange };

/**
 * Subscribes a component to the RAW preference (may be 'auto') — for the
 * Settings UI's own control, which needs to know whether "Automático" is
 * currently selected. Boards/menus that just want a palette should use
 * `useTimeOfDay()` (resolved) or `usePalette()` instead.
 */
export function useTimeOfDaySetting(): TimeOfDaySetting {
  const [value, setValue] = useState<TimeOfDaySetting>(TimeOfDayManager.get());
  useEffect(() => {
    void TimeOfDayManager.init();
    setValue(TimeOfDayManager.get());
    const unsubscribe = TimeOfDayManager.onChange(setValue);
    startAutoWatch();
    return () => {
      unsubscribe();
      stopAutoWatch();
    };
  }, []);
  return value;
}

/**
 * The RESOLVED pass a board/menu should draw with — 'auto' already turned
 * into a concrete `TimeOfDay` against the clock. This is the same hook the
 * game boards have always called; they inherit the 'auto' mode for free.
 */
export function useTimeOfDay(): TimeOfDay {
  const [value, setValue] = useState<TimeOfDay>(TimeOfDayManager.getResolved());
  useEffect(() => {
    void TimeOfDayManager.init();
    setValue(TimeOfDayManager.getResolved());
    const unsubscribe = TimeOfDayManager.onChange(() => setValue(TimeOfDayManager.getResolved()));
    startAutoWatch();
    return () => {
      unsubscribe();
      stopAutoWatch();
    };
  }, []);
  return value;
}

/**
 * The palette a board should draw with. `override` lets a caller pin a pass
 * (screenshots, the settings preview) without touching the stored preference.
 */
export function usePalette(override?: TimeOfDay | null): TimeOfDayPalette {
  const resolved = useTimeOfDay();
  return getTimeOfDayPalette(override ?? resolved);
}
