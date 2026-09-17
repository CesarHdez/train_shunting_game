import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Raleway_500Medium, Raleway_600SemiBold, Raleway_700Bold, Raleway_800ExtraBold } from '@expo-google-fonts/raleway';
import RootNavigator from './src/navigation/RootNavigator';
import { PlayerProvider } from './src/controller/PlayerContext';
import { initBackend } from './src/backend/backendApi';
import { SoundManager } from './src/audio/sounds';

export default function App() {
  // Raleway is the menu-screen typeface (design_handoff_menus/README.md §1)
  // for Login/ModeSelect/LevelSelect/Settings/Leaderboard — the game
  // board/HUD keeps Rajdhani, loaded separately for Skia via useFont (see
  // src/render/primitives/labelFont.ts), which is a different mechanism.
  // `fontError` is intentionally not surfaced anywhere: if Google Fonts ever
  // fails to resolve, the menus fall back to the platform system font
  // instead of crashing — see the render gate below.
  const [fontsLoaded, fontError] = useFonts({
    Raleway_500Medium,
    Raleway_600SemiBold,
    Raleway_700Bold,
    Raleway_800ExtraBold,
  });

  useEffect(() => {
    // Loads the local score cache and wires the real (AsyncStorage +
    // best-effort Firestore) BackendApi implementation into the controller
    // layer via setBackendApi() — see src/backend/backendApi.ts. Every
    // screen keeps calling getBackendApi() from src/controller/backendApi
    // and picks this up transparently; the offline-only LocalBackendApi
    // there is only a fallback for the (very short) window before this
    // resolves, or if src/backend is ever removed from the build.
    void initBackend();
    // Loads the persisted mute preference and preloads the SFX player
    // pools — see src/audio/sounds.ts. Never throws; gameplay is fully
    // unaffected if this fails.
    void SoundManager.init();
  }, []);

  // Hold the very first frame back until Raleway resolves (loaded OR
  // failed) so menu text never flashes in an unstyled fallback font, but
  // never blocks forever — a font load failure still renders the app.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PlayerProvider>
          <NavigationContainer>
            <StatusBar style="light" />
            <RootNavigator />
          </NavigationContainer>
        </PlayerProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
