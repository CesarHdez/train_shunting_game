/**
 * Shunting level-1 tutorial — ported from ref/js/shunting/state.js
 * (`tutModal`, `advanceTutModal`, `skipTutorial`) + the gating logic in
 * ref/js/shunting/input.js `handleTutorialClick`.
 *
 * Steps: -1 off · 0 welcome modal · 1 objective modal · 2 hint:place loco
 * on the track holding "A" · 3 hint:select car A · 4 hint:move to a valid
 * destination track. Steps 0/1 block ALL board input (only their own
 * NEXT/SKIP buttons are live); steps 2-4 allow exactly one taught action
 * and silently swallow everything else, exactly like the reference.
 *
 * Persisted completion flag mirrors the reference's
 * `localStorage['train_tutorial_done']` via AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ClassificationState, ShuntingState } from '../engine/types';

export type TutorialStep = -1 | 0 | 1 | 2 | 3 | 4;

const TUTORIAL_DONE_KEY = 'train_tutorial_done';

export async function isTutorialDone(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(TUTORIAL_DONE_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markTutorialDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(TUTORIAL_DONE_KEY, '1');
  } catch {
    // best-effort
  }
}

// ───────────────────── RIGHT-LOCO DISCOVERY HINT ─────────────────────
/**
 * One-time contextual hint shown the first time a player reaches a shunting
 * level with `hasRightLoco === true` — explains the second (right-side)
 * locomotive couples/deposits from the TAIL end, mirrored from the left
 * loco's head-end rule. Persisted independently of the level-1 tutorial
 * flags above so dismissing/completing one never affects the other.
 */
const RIGHT_LOCO_HINT_DONE_KEY = 'train_rightloco_hint_done';

export async function isRightLocoHintDone(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(RIGHT_LOCO_HINT_DONE_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markRightLocoHintDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(RIGHT_LOCO_HINT_DONE_KEY, '1');
  } catch {
    // best-effort
  }
}

export const RIGHT_LOCO_HINT_COPY = {
  title: '¡DOS LOCOMOTORAS!',
  lines: [
    'Este nivel tiene una segunda locomotora a la DERECHA.',
    'Engancha los vagones por la COLA (lado derecho) y los deja por ese mismo lado.',
    'Úsala junto con la locomotora izquierda para resolver el patio.',
  ],
  button: 'ENTENDIDO',
} as const;

/** Shape shared by every blocking welcome/objective modal, shunting or classification. */
export interface TutorialModalCopy {
  title: string;
  lines: readonly string[];
  button: string;
}

export const TUTORIAL_MODAL_COPY = {
  welcome: {
    title: '¡BIENVENIDO!',
    lines: [
      'Patio de Trenes es un puzzle de maniobras ferroviarias.',
      'Tu misión: ordenar los vagones en la secuencia correcta.',
    ],
    button: 'SIGUIENTE',
  },
  objective: {
    title: 'EL OBJETIVO',
    lines: [
      'La barra superior muestra el orden requerido de vagones.',
      'Lográ que una vía tenga exactamente esa secuencia.',
    ],
    button: '¡ENTENDIDO!',
  },
  skipLabel: 'Saltar tutorial',
} as const;

/** Ordered modal list for step 0/1 — index === tutorialStep while step < 2. */
export const TUTORIAL_MODALS: readonly TutorialModalCopy[] = [
  TUTORIAL_MODAL_COPY.welcome,
  TUTORIAL_MODAL_COPY.objective,
];

/** Index 0/1/2 <-> tutModal 2/3/4. */
export const TUTORIAL_HINT_TEXTS = [
  'Colocá la locomotora en la vía que tiene el vagón A',
  '¡Bien! Ahora hacé clic en el vagón A para seleccionarlo',
  '¡Perfecto! Hacé clic en otra vía para mover el vagón',
] as const;

export function tutorialHintText(step: number): string | null {
  if (step < 2) return null;
  return TUTORIAL_HINT_TEXTS[step - 2] ?? null;
}

/** Semantic board tap shape shared with the shunting controller. */
export interface ShuntingTapEvent {
  kind: 'locoButton' | 'wagon' | 'trackRow';
  side?: 'left' | 'right';
  track: number;
  car?: number;
}

/** The track index holding car "A" — the tutorial's fixed teaching target. */
export function tutorialTargetTrack(state: ShuntingState): number {
  return state.tracks.findIndex((t) => t.includes('A'));
}

/**
 * True iff `event` is exactly the action taught by tutorial `step`.
 * Callers must NOT invoke this for step <= 1 (modal steps) — those block
 * all board input unconditionally; only the modal's own buttons advance.
 */
export function isTutorialStepSatisfied(
  step: TutorialStep,
  state: ShuntingState,
  event: ShuntingTapEvent
): boolean {
  if (step === 2) {
    const tA = tutorialTargetTrack(state);
    return tA >= 0 && event.kind === 'locoButton' && event.side === 'left' && event.track === tA;
  }
  if (step === 3) {
    const tA = state.locoTrack;
    if (tA < 0) return false;
    const colA = state.tracks[tA].indexOf('A');
    return colA >= 0 && event.kind === 'wagon' && event.track === tA && event.car === colA;
  }
  if (step === 4) {
    if (event.track === state.locoTrack) return false;
    return event.kind === 'locoButton' || event.kind === 'trackRow';
  }
  return false;
}

// ───────────────────── CLASSIFICATION TUTORIAL (Turno 1) ─────────────────────
/**
 * Turno-1 (classification level 1) tutorial — lighter than the shunting one
 * since "empujar" is a single action instead of a 3-step select/move dance.
 *
 * Steps: -1 off · 0 welcome modal · 1 "regla del lomo" modal · 2 objective/
 * scoring modal · 3 hint:push the head car to a classification track · 4
 * hint:push another one to reinforce. Steps 0-2 block ALL board input (only
 * their own NEXT/SKIP buttons are live); steps 3-4 allow exactly one taught
 * action (a valid classification-track push) and silently swallow everything
 * else, mirroring the shunting gating in `isTutorialStepSatisfied` above.
 *
 * Persisted completion flag mirrors `train_tutorial_done` via AsyncStorage,
 * under its own key so completing one mode's tutorial never marks the other
 * done.
 */
export type ClfTutorialStep = -1 | 0 | 1 | 2 | 3 | 4;

const CLF_TUTORIAL_DONE_KEY = 'train_clf_tutorial_done';

export async function isClfTutorialDone(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CLF_TUTORIAL_DONE_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markClfTutorialDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(CLF_TUTORIAL_DONE_KEY, '1');
  } catch {
    // best-effort
  }
}

export const CLF_TUTORIAL_MODAL_COPY = {
  welcome: {
    title: '¡PATIO DE CLASIFICACIÓN!',
    lines: ['Ordená los vagones según su destino (color).'],
    button: 'SIGUIENTE',
  },
  headRule: {
    title: 'LA REGLA DEL LOMO',
    lines: [
      'Solo podés empujar el vagón de la CABEZA',
      '(el del lomo) de una vía de llegada.',
    ],
    button: 'SIGUIENTE',
  },
  objective: {
    title: 'EL OBJETIVO',
    lines: [
      'Enviá cada vagón a una vía y agrupalos por color.',
      'Vías de un solo color dan +bonus; mezclar colores penaliza.',
    ],
    button: '¡A JUGAR!',
  },
  skipLabel: 'Saltar tutorial',
} as const;

/** Ordered modal list for step 0/1/2 — index === tutorialStep while step < 3. */
export const CLF_TUTORIAL_MODALS: readonly TutorialModalCopy[] = [
  CLF_TUTORIAL_MODAL_COPY.welcome,
  CLF_TUTORIAL_MODAL_COPY.headRule,
  CLF_TUTORIAL_MODAL_COPY.objective,
];

/** Index 0/1 <-> tutorialStep 3/4. */
export const CLF_TUTORIAL_HINT_TEXTS = [
  'Empujá el vagón del lomo a una vía de clasificación',
  '¡Bien! Empujá otro vagón a una vía de clasificación',
] as const;

export function clfTutorialHintText(step: number): string | null {
  if (step < 3) return null;
  return CLF_TUTORIAL_HINT_TEXTS[step - 3] ?? null;
}

/** Semantic board tap shape shared with the classification controller. */
export interface ClassificationTapEvent {
  kind: 'arrival' | 'classification';
  track: number;
}

/**
 * True iff `event` is exactly the action taught by tutorial `step`: a push
 * (tap on a classification track) onto a track that still has room. Callers
 * must NOT invoke this for step <= 2 (modal steps) — those block all board
 * input unconditionally; only the modal's own buttons advance.
 */
export function isClfTutorialStepSatisfied(
  step: ClfTutorialStep,
  state: ClassificationState,
  event: ClassificationTapEvent
): boolean {
  if (step !== 3 && step !== 4) return false;
  if (event.kind !== 'classification') return false;
  const t = event.track;
  if (t < 0 || t >= state.clasif.length) return false;
  return state.clasif[t].length < state.capacities[t];
}
