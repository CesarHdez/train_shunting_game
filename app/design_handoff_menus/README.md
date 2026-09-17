# Handoff: Menús no-jugables → "Hora Dorada" con reloj automático

Rediseño visual de **Login, ModeSelect, LevelSelect, Settings y Leaderboard**
(las 5 pantallas que NO son el tablero de juego). El tablero de juego
(`ShuntingBoard`/`ClassificationBoard`) no se toca — ya tiene su propio
handoff (`design_handoff_isometric_yard/`).

Dirección elegida: **"Hora Dorada"** — extiende la paleta/atmósfera isométrica
del tablero (cielo degradado, colinas en silueta, torre de señales) a los
menús, y en vez de que el jugador elija la hora manualmente, **la paleta
sigue el reloj real del dispositivo** por defecto.

Referencia visual: `Menús — Propuestas de Diseño.dc.html` (abrir en navegador,
ir a la sección `#2a` — es la versión final; `#1a`/`#1b`/`#1c` más abajo son
exploración descartada, ignorar).

## 0. Alcance — qué cambia y qué no
- Cambia: apariencia visual de las 5 pantallas listadas arriba. Tipografía,
  color, forma de tarjetas/botones, iconografía (se eliminan TODOS los
  emojis), y la fuente de la paleta (reloj en vez de selector manual).
- No cambia: navegación (`RootNavigator.tsx`/`types.ts`), lógica de
  progreso/backend (`backendApi.ts`), estructura de datos, `PlayerContext`,
  `SoundManager`, haptics, ni ninguna pantalla de juego o su render Skia.
- `timeOfDayPalettes` / `TimeOfDayManager` en `design/tokens.ts` y
  `src/render/iso/timeOfDay.ts` YA EXISTEN (del rediseño del tablero) — este
  cambio los **reutiliza**, no los recrea. Ver §2.

## 1. Tipografía — Raleway
Sustituye Rajdhani (`fontFamily` en `tokens.ts`) por **Raleway** en las 5
pantallas de este handoff (el tablero/HUD de juego sigue en Rajdhani, no se
toca por este cambio).

- Paquete: `@expo-google-fonts/raleway`.
- Pesos a cargar: `Raleway_500Medium`, `Raleway_600SemiBold`,
  `Raleway_700Bold`, `Raleway_800ExtraBold`.
- Añadir un segundo grupo de familia en `tokens.ts`, sin borrar el de
  Rajdhani (el tablero lo sigue usando):
  ```ts
  export const fontFamilyMenu = {
    medium: 'Raleway_500Medium',
    semiBold: 'Raleway_600SemiBold',
    bold: 'Raleway_700Bold',
    extraBold: 'Raleway_800ExtraBold',
  } as const;
  ```
- Los 5 screens de este handoff deben construir su propio `typeScale` local
  (o un segundo `typeScaleMenu` en `tokens.ts`) apuntando a
  `fontFamilyMenu.*` en vez de `fontFamily.*`, mismos tamaños/letterSpacing
  que ya existen en `typeScale` — solo cambia la familia.

## 2. Paleta automática por hora del sistema
`timeOfDayPalettes.{amanecer,mediodia,atardecer,noche}` ya están definidas.
Lo nuevo es la fuente de selección: hoy `TimeOfDayManager` guarda una
preferencia manual; se necesita un modo **`'auto'`** adicional.

**Franjas horarias** (hora local del dispositivo, 24h):
| Franja | Rango | Paleta |
|---|---|---|
| Amanecer | 05:00–07:59 | `amanecer` |
| Mediodía | 08:00–16:59 | `mediodia` |
| Atardecer | 17:00–19:59 | `atardecer` |
| Noche | 20:00–04:59 | `noche` |

```ts
// src/render/iso/timeOfDay.ts — extender, no reescribir
export type TimeOfDaySetting = TimeOfDay | 'auto';

export function resolveAutoTimeOfDay(date = new Date()): TimeOfDay {
  const h = date.getHours();
  if (h >= 5 && h < 8) return 'amanecer';
  if (h >= 8 && h < 17) return 'mediodia';
  if (h >= 17 && h < 20) return 'atardecer';
  return 'noche';
}
```
- Persistir la preferencia como `TimeOfDaySetting` (incluye `'auto'`), no solo
  `TimeOfDay`. Default: `'auto'`.
- Un hook (`useTimeOfDay()` ya existe — extenderlo) debe re-evaluar
  `resolveAutoTimeOfDay()` cuando `setting === 'auto'`: en el montaje, al
  volver de background (`AppState` listener), y opcionalmente con un
  `setInterval` de ~60s mientras la app está en foreground, para cruzar una
  franja sin reabrir la app.
- El tablero de juego (que ya consume `useTimeOfDay()`) automáticamente
  hereda el modo automático — no requiere cambios ahí, es el mismo hook.

## 3. Iconografía — cero emojis
Todo emoji (`🚂 ⚙ 🏆 🔒 ⭐ 🔓 ✓`) se reemplaza por un ícono de línea propio.
Los 10 SVG están en `icons/*.svg` de esta carpeta (viewBox 24×24 salvo
`train.svg`, 52×34) con `stroke="currentColor"`/`fill="currentColor"` — pásalos
a `react-native-svg` como `<Path d="…">` dentro de un `<Svg>`, tiñendo con
`color`/`stroke` desde los tokens de paleta activa (así el ícono cambia de
color con la franja horaria igual que el HUD del tablero).

| Archivo | Reemplaza a | Uso |
|---|---|---|
| `train.svg` | 🚂 | Logo login, "Acerca de" en Settings |
| `gear.svg` | ⚙ | Botón Ajustes en ModeSelect |
| `sound.svg` | (nuevo, no existía) | Podría acompañar el toggle de Sonido si se quiere icono + texto |
| `trophy.svg` | 🏆 | Botón "Puntajes" en LevelSelect, header Leaderboard |
| `starOutline.svg` / relleno con `fill="currentColor"` | ⭐ | `StarRow` — en vez de dibujar la estrella actual, usar este path relleno (activa) / con `opacity .2` (inactiva) |
| `lock.svg` | 🔒 | Sección/nivel bloqueado |
| `back.svg` | flecha "←" | Botones "VOLVER"/"MODOS" |
| `clock.svg` | (nuevo) | Badge "Automático" en Login/Settings |
| `check.svg` | ✓ | Contador de niveles completados en la cabecera de sección |
| `vibration.svg` | (nuevo, opcional) | Acompañar el toggle de Vibración |

`StarRow.tsx` ya dibuja una estrella con Skia — reemplazar su `Path` por el
mismo polígono que `starOutline.svg` (10 puntos, ya extraído) en vez de
crear una segunda geometría de estrella.

## 4. Tokens de color nuevos (menú) — `tokens.ts`
Los menús ya no usan un solo `colors.background`/`colors.login.*` fijo: leen
la paleta activa (`getTimeOfDayPalette(resolvedTimeOfDay)`) igual que el
tablero. Mapeo de qué campo de `TimeOfDayPalette` alimenta cada rol de UI de
menú (todos YA EXISTEN en la paleta, ninguno es nuevo):

| Rol de UI | Campo de `TimeOfDayPalette` |
|---|---|
| Fondo de pantalla (gradiente) | `sky.colors` / `sky.positions` |
| Silueta de colinas | `scenery.hill` + `scenery.hillOpacity` |
| Halo de sol/luna | `scenery.sun` (null en noche → sin halo, o usar `scenery.stars`) |
| Texto principal | `hud.text` |
| Texto secundario/subtítulos | `hud.textDim` |
| Acento (botón primario, bordes de tarjeta activa, badge "Automático") | `hud.accent` |
| Fondo de tarjeta/glass | `hud.buttonBg` (mismo rgba translúcido que ya usan los botones del HUD) |
| Borde de tarjeta/glass | `hud.buttonBorder` |
| Fondo de botón "peligro" (Reiniciar progreso) | fijo, no depende de franja: `colors.button.danger` (ya existe, no cambia) |
| Color de check/success (contador de sección) | `hud.statSuccess` |

No se crea NINGÚN color nuevo — todo sale de `timeOfDayPalettes`, que ya
pasó por el análisis de contraste del handoff del tablero.

**Contraste**: verificar `hud.text`/`hud.textDim` contra `sky.colors[0]`
(el tono más oscuro de cada gradiente, que es donde caen los inputs/tarjetas
con fondo `hud.buttonBg`) — ya validado para el HUD del tablero en el otro
handoff; los menús reutilizan los mismos pares, así que no requiere una
segunda pasada de contraste, solo confirmarlo al implementar sobre fondos
reales (las tarjetas glass oscurecen el fondo, ayuda al contraste en vez de
perjudicarlo).

## 5. Especificación por pantalla
Todas mantienen su lógica actual (`LoginScreen.tsx`, `ModeSelectScreen.tsx`,
`LevelSelectScreen.tsx`, `SettingsScreen.tsx`, `LeaderboardScreen.tsx`) —
solo se re-skinnean sus `StyleSheet.create` y el árbol de JSX que dibuja
chrome/iconos, usando el layout que YA define `design-system.md` (topBar,
safe-area, breakpoints, minTapTarget 48dp, etc. sin cambios).

- **Login**: fondo cielo con colinas y torre de señales en silueta (SVG
  simple, 2 formas). Tarjeta "glass" (blur + `hud.buttonBg`/`hud.buttonBorder`)
  reemplaza la tarjeta plana actual. Logo: mini locomotora de 3 formas (caja +
  cabina + luz) en `hud.accent`, no el `train.svg` completo (ese va en
  "Acerca de"). Badge de reloj arriba a la derecha: ícono `clock.svg` +
  "AUTOMÁTICO · {label de la paleta activa}", mismo tratamiento glass.
- **ModeSelect**: gear (`gear.svg`) sustituye ⚙; el ícono de "sonido" del
  `MuteToggleButton` ya no es texto/emoji, usa `sound.svg` con una barra
  diagonal superpuesta cuando está muteado. Cada `ModeCard` gana un anillo de
  progreso circular (arco simple, no una librería nueva) con el porcentaje en
  el centro, en vez del texto plano actual.
- **LevelSelect**: header con `back.svg` + "MODOS" y `trophy.svg` + label
  corto (sin la palabra "PUNTAJES" repetida al lado del ícono si no cabe en
  compact). Contador de sección: `check.svg` + "8/10" y estrella rellena +
  "21" (sin emoji). Tarjeta bloqueada: `lock.svg` centrado, sin número de
  nivel visible (ya es la convención actual, solo cambia el glifo).
- **Settings**: tarjeta "HORA DEL PATIO" reestructurada — fila "Automático"
  arriba (ícono reloj + label + pill "ACTIVO"/nada), franjas manuales abajo
  como 4 swatches más pequeños que antes (ahora es la anulación, no la
  elección principal). El resto de tarjetas (nombre, sonido, vibración,
  reiniciar, acerca de) heredan el nuevo glass/tipografía sin reestructurarse.
- **Leaderboard**: mismo layout de filas (`badge` + `top3` mini-cards), pero
  fondo/tarjetas en el nuevo glass y `MEDAL_COLORS` sin cambio (ya son
  accesibles). Quitar el emoji si quedó alguno en el offline badge — usar
  texto solo ("SIN CONEXIÓN") o un ícono de nube tachada si se quiere.

## 6. Archivos de esta carpeta
- `README.md` — este documento.
- `icons/*.svg` — los 10 glifos, listos para convertir a `<Path>` de
  `react-native-svg` (copiar el atributo `d` de cada `<path>`).
- `Menús — Propuestas de Diseño.dc.html` — referencia visual completa,
  abrir en navegador, sección `#2a` es la versión aprobada.
- `PROMPT_PARA_CLAUDE_CODE.md` — texto listo para pegar en Claude Code.
