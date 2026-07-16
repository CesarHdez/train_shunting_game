// js/core/app.js — Estado global de la aplicación (compartido entre modos)

// mode: null → pantalla de selección de modo
//       'shunting'       → Patio de Maniobras (juego original)
//       'classification' → Patio de Clasificación
export const app = {
    mode: null,
    playerName: '',
};
