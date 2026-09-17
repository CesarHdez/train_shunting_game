/**
 * Maps design/tokens.ts's string haptic identifiers to expo-haptics calls.
 * See design/tokens.ts's `haptics` export doc comment for the mapping table.
 */
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type HapticToken =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error'
  | 'selection';

// ── Mute preference — mirrors src/audio/sounds.ts's SoundManager mute flag
// (same shape: in-memory cache + AsyncStorage persistence + listeners), but
// default UNMUTED (haptics fire unless the player explicitly turns them off
// in Settings). Kept in this file (rather than a separate module) since
// fireHaptic is the single call site that needs to check it. ──────────────

const HAPTICS_MUTE_STORAGE_KEY = 'train_haptics_muted';

let hapticsMuted = false;
let hapticsInitPromise: Promise<void> | null = null;
const hapticsListeners = new Set<(muted: boolean) => void>();

function notifyHapticsListeners(): void {
  for (const l of hapticsListeners) {
    try {
      l(hapticsMuted);
    } catch {
      // a bad listener must not break the others
    }
  }
}

/** Loads the persisted haptics-mute preference. Never throws; safe to call
 *  repeatedly (subsequent calls reuse the same promise). Kicked off eagerly
 *  below so `isHapticsMuted()` reflects the saved preference shortly after
 *  app start — any haptic fired in the brief window before this resolves
 *  just uses the default (unmuted), which matches pre-Settings behavior. */
function initHaptics(): Promise<void> {
  if (hapticsInitPromise) return hapticsInitPromise;
  hapticsInitPromise = (async () => {
    try {
      const stored = await AsyncStorage.getItem(HAPTICS_MUTE_STORAGE_KEY);
      hapticsMuted = stored === '1';
    } catch {
      hapticsMuted = false;
    }
    notifyHapticsListeners();
  })().catch(() => {
    // init() itself must never reject.
  });
  return hapticsInitPromise;
}
void initHaptics();

export function isHapticsMuted(): boolean {
  return hapticsMuted;
}

/** Sets the haptics-mute flag and persists it. Never throws. */
export async function setHapticsMuted(value: boolean): Promise<void> {
  hapticsMuted = value;
  notifyHapticsListeners();
  try {
    await AsyncStorage.setItem(HAPTICS_MUTE_STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Best-effort persistence — the in-memory flag above still applies for
    // the rest of this session even if writing to disk fails.
  }
}

/** Subscribes to haptics-mute changes (e.g. to sync a Settings switch if
 *  toggled elsewhere). Returns an unsubscribe function. */
export function onHapticsMuteChange(listener: (muted: boolean) => void): () => void {
  hapticsListeners.add(listener);
  return () => hapticsListeners.delete(listener);
}

/** Fires `token`'s haptic unless the player has muted vibration in Settings. */
export async function fireHaptic(token: HapticToken): Promise<void> {
  if (hapticsMuted) return;
  try {
    switch (token) {
      case 'light':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      case 'medium':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return;
      case 'heavy':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        return;
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      case 'warning':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      case 'error':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      case 'selection':
        await Haptics.selectionAsync();
        return;
    }
  } catch {
    // Haptics unsupported/disabled on this device — no-op per
    // design-system.md §5.4 ("always check ... doesn't throw").
  }
}
