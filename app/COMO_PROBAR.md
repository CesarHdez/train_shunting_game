# Cómo probar la app "Patio de Trenes"

Guía para probar el juego en el PC y/o en un teléfono. La app usa **Expo + React Native + Skia** (módulo nativo), por lo que **Expo Go NO sirve** — hace falta un *dev-build* (o el preview web).

La app está **bloqueada en horizontal** (`orientation: "landscape"`).

---

## Opción A — Preview web (inmediata, sin instalar nada)

Sirve para ver jugabilidad y layout. Es un navegador, **no** un teléfono real: no hay bloqueo de orientación forzado, ni vibración, y el audio es HTML5.

1. Asegúrate de que el servidor de preview esté corriendo. Si no, desde `app/`:
   ```bash
   # exportar el build web (si hiciste cambios)
   npx expo export --platform web --output-dir .webdist
   cp public/canvaskit.wasm .webdist/canvaskit.wasm
   # servirlo
   node tools/serve.mjs .webdist 8090
   ```
2. Abre en el navegador: **http://localhost:8090**
3. Para verlo en **horizontal**:
   - Ensancha la ventana (más ancha que alta), **o**
   - `F12` (DevTools) → modo dispositivo (`Ctrl+Shift+M`) → elige un teléfono y ponlo en **orientación horizontal**.

> Alternativa con recarga en vivo (dev server): `npm run web`.

---

## Opción B — Emulador Android en el PC (Android Studio)

La forma de probarlo como app real en el PC. Requiere instalar el SDK/emulador de Android.
**Requisitos ya presentes:** Java (OpenJDK 21) ✅. **Falta:** Android Studio + un emulador.

### 1. Instalar Android Studio
- Descargar: https://developer.android.com/studio
- Instalar con los componentes por defecto (**Android SDK** + **Android Virtual Device**).
- En el primer arranque, el asistente descarga el SDK — aceptar y esperar.

### 2. Crear y arrancar un emulador
- Android Studio → **More Actions → Virtual Device Manager → Create Device**
- Elegir p. ej. **Pixel 7** → descargar una **system image** (API 34 o 35) → **Finish**
- Arrancar el emulador con el botón ▶
- Si va lento: activar **"Plataforma del hipervisor de Windows" (WHPX)** en *Activar o desactivar características de Windows*.

### 3. Configurar la variable de entorno
El SDK suele quedar en:
```
C:\Users\Personal\AppData\Local\Android\Sdk
```
Añadir la variable de usuario:
- `ANDROID_HOME` = esa ruta
- (opcional) añadir al PATH: `%ANDROID_HOME%\platform-tools` y `%ANDROID_HOME%\emulator`

Verificar en una terminal nueva:
```bash
adb version
```

### 4. Compilar e instalar el dev-build en el emulador
Con el emulador **corriendo**, desde `app/`:
```bash
npx expo run:android
```
- La **primera vez tarda varios minutos** (genera el proyecto nativo `android/`, compila con Gradle e instala la app).
- Después, para reabrir: basta iniciar el bundler con `npx expo start --dev-client` y abrir la app ya instalada en el emulador.

En el emulador sí se prueba de verdad: **bloqueo horizontal, táctil, audio y vibración**.

---

## Opción C — APK real por EAS (para tu teléfono)

Genera un APK en la nube que instalas en un teléfono Android físico. Es lo más fiel.

1. Login de Expo (una vez): `npx expo login`
2. Build de APK (perfil "preview"):
   ```bash
   npx eas build -p android --profile preview
   ```
   (La primera vez EAS crea el proyecto y pide confirmar `eas.json`.)
3. Al terminar, EAS da un enlace para **descargar el APK** e instalarlo en el teléfono (activar "instalar de orígenes desconocidos").

---

## Notas del proyecto
- `app.json`: `orientation: "landscape"`, `android.package: "com.patiodetrenes.app"`, nombre "Patio de Trenes".
- Backend Firebase (leaderboards) es compartido con la versión web; funciona offline igual.
- Tests del motor: `npm test` (46 tests). Typecheck: `npx tsc --noEmit`.
