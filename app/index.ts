import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately.
//
// On web, @shopify/react-native-skia needs the CanvasKit WASM loaded before any
// Skia component renders. This bootstrap is web-only; native registers directly.
if (Platform.OS === 'web') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { LoadSkiaWeb } = require('@shopify/react-native-skia/lib/module/web');
  LoadSkiaWeb({ locateFile: () => '/canvaskit.wasm' })
    .then(() => {
      const App = require('./App').default;
      registerRootComponent(App);
    })
    .catch((e: unknown) => {
      // eslint-disable-next-line no-console
      console.error('Failed to load CanvasKit for Skia web:', e);
    });
} else {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const App = require('./App').default;
  registerRootComponent(App);
}
