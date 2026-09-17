/**
 * Ambient augmentation restoring `getReactNativePersistence`'s type on
 * `firebase/auth`.
 *
 * Runtime behavior is unaffected — Metro correctly resolves the JS via the
 * `firebase`/`@firebase/auth` package.json "react-native" export condition,
 * and `getReactNativePersistence` genuinely exists there
 * (@firebase/auth/dist/rn/index.js). The gap is TypeScript-only: the
 * `firebase` npm package's package.json#exports maps the "./auth" subpath's
 * "types" condition to a single flat, platform-agnostic declaration file
 * (auth-public.d.ts) regardless of the "react-native" condition, so `tsc`
 * never resolves to dist/rn/index.rn.d.ts (where the function IS declared)
 * when importing from `firebase/auth` (as opposed to `@firebase/auth`
 * directly). This is a known upstream firebase-js-sdk papercut, not a bug in
 * this project's code — this file only restores the missing type.
 */
import type { Persistence, ReactNativeAsyncStorage } from 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
