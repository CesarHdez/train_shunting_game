Pega esto en Claude Code, dentro del repo de la app (`app/`), con la carpeta
`design_handoff_menus/` copiada a la raíz del repo (o ajusta las rutas).

---

Rediseña las 5 pantallas no-jugables de esta app (Login, ModeSelect,
LevelSelect, Settings, Leaderboard) siguiendo el handoff en
`design_handoff_menus/README.md`. Antes de tocar código, lee ese README
completo, la referencia visual `design_handoff_menus/Menús — Propuestas de
Diseño.dc.html` (sección `#2a`), y los 10 SVG en `design_handoff_menus/icons/`.

Trabaja en este orden:

1. **Tipografía**: instala `@expo-google-fonts/raleway`, añade
   `fontFamilyMenu` a `design/tokens.ts` (ver README §1), y usa esa familia
   solo en las 5 pantallas de este handoff — no toques `fontFamily` (Rajdhani)
   ni el render Skia del tablero.

2. **Reloj automático de paleta**: extiende `src/render/iso/timeOfDay.ts`
   con un modo `'auto'` (ver README §2 — franjas horarias exactas y la
   función `resolveAutoTimeOfDay`). Debe re-evaluarse al volver de background
   (`AppState`) y cada ~60s en foreground. Persiste la preferencia
   (`'auto' | TimeOfDay`) con el mismo mecanismo que ya usa
   `TimeOfDayManager`. Default: `'auto'`.

3. **Iconos**: convierte cada SVG de `design_handoff_menus/icons/` en un
   componente `react-native-svg` (`<Svg><Path d="..." /></Svg>`), coloreado
   con `stroke`/`fill` desde la paleta activa (`hud.accent`/`hud.text` según
   el caso). Elimina TODOS los emojis del código de estas 5 pantallas —
   `LoginScreen.tsx`, `ModeSelectScreen.tsx`, `LevelSelectScreen.tsx`,
   `SettingsScreen.tsx`, `LeaderboardScreen.tsx`, y sus componentes hijos
   (`ModeCard.tsx`, `LevelCard.tsx`, `MuteToggleButton.tsx`, `StarRow.tsx`,
   `hud/OfflineBadge.tsx`). La tabla de reemplazo exacta está en README §3.

4. **Re-skin de cada pantalla**: usa `getTimeOfDayPalette(resolvedTimeOfDay)`
   para leer sky/hud/scenery (mapeo exacto en README §4) en vez de los
   colores fijos actuales (`colors.background`, `colors.login.*`, etc.).
   Sigue la especificación por pantalla del README §5 para qué cambia en
   cada una (fondo con colinas en Login, anillo de progreso en ModeCard,
   reestructura de "HORA DEL PATIO" en Settings con "Automático" como opción
   principal, etc.). No cambies navegación, lógica de datos/backend, ni el
   layout/breakpoints/tap-targets que ya define `design-system.md` — esto es
   un re-skin visual, no un rediseño de flujo.

5. Verifica que el tablero de juego (Shunting/Classification) sigue
   funcionando igual: solo debe notar el reloj automático si ya usaba
   `useTimeOfDay()` con una preferencia guardada como `'auto'` (esto es
   intencional — es el mismo interruptor, coherente en toda la app).

Si algo del README es ambiguo para una pantalla concreta, prioriza la
referencia visual (`#2a` en el `.dc.html`) sobre la prosa.
