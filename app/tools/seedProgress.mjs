/**
 * BYPASS DE PROGRESIÓN — SOLO PARA PRUEBAS.
 *
 * Vive en `tools/` y NUNCA en `src/`: nada de este archivo entra en el paquete
 * que se compila para la app, así que un jugador no puede alcanzarlo de ninguna
 * forma. No existe ningún interruptor equivalente dentro del producto.
 *
 * Cómo funciona, y por qué así:
 *  - La app guarda los mejores puntajes locales vía AsyncStorage, que en React
 *    Native Web es `localStorage` bajo la clave cruda (`train_scores_v2` para
 *    Maniobras — ver src/backend/scoreManager.ts).
 *  - Un nivel cuenta como COMPLETADO si tiene al menos una entrada guardada
 *    (`ScoreManager.isCompletedSync`).
 *  - Una sección se desbloquea cuando la anterior tiene >= 8 de sus 10 niveles
 *    completados (`UNLOCK_THRESHOLD` en src/controller/sections.ts). Sembrar
 *    los niveles 1..N desbloquea por tanto todas las secciones hasta N/10 + 1.
 *  - `ScoreManager.load()` conserva sin tocar cualquier entrada que NO lleve el
 *    campo `_h` (compatibilidad con entradas antiguas), así que la siembra no
 *    necesita replicar el hash djb2 de integridad.
 *
 * Uso: `SEED_LEVELS=50 node tools/webshot.mjs` → desbloquea hasta la sección 6
 * (niveles 51-60), que es donde aparece la locomotora derecha.
 * Sin `SEED_LEVELS`, esta función no hace nada en absoluto.
 */

const SHUNTING_KEY = 'train_scores_v2';

/** Siembra progreso ANTES de que cargue la app. Devuelve cuántos niveles sembró (0 = desactivado). */
export async function seedProgress(page) {
  const upTo = Number(process.env.SEED_LEVELS || 0);
  if (!Number.isFinite(upTo) || upTo <= 0) return 0;

  await page.evaluateOnNewDocument(
    (key, n) => {
      const data = {};
      for (let id = 1; id <= n; id++) {
        data[String(id)] = [
          {
            name: 'Tester',
            moves: 1,
            time: 5,
            score: 1000,
            stars: 3,
            date: '1/1/2026',
            uid: 'seed' + id,
          },
        ];
      }
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {
        // Sin almacenamiento disponible: la siembra simplemente no aplica.
      }
    },
    SHUNTING_KEY,
    upTo
  );
  return upTo;
}
