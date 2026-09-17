/**
 * Player-name persistence — port of ref/js/main.js `setupLogin`'s
 * `localStorage.getItem/setItem('train_player_name', ...)`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'train_player_name';

export async function getSavedPlayerName(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function savePlayerName(name: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, name);
  } catch {
    // best-effort
  }
}
