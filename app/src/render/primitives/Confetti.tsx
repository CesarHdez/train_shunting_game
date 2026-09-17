/**
 * Win/summary confetti burst — Skia port of ref/js/core/particles.js
 * `ParticleSystem.spawnConfetti`.
 *
 * The reference steps ~160 particles once per animation frame on the JS
 * thread (`update()` mutates a plain array every tick). We instead solve
 * the same constant-gravity / velocity-damping physics in closed form
 * (see the derivation in this file) and evaluate it inside a single
 * Reanimated `useDerivedValue` per particle — the whole burst runs on the
 * UI thread with zero per-frame JS work, matching design-system.md §5.3.
 *
 * Mount `<Confetti active levelKey={state.levelNum} />` guarded by the
 * caller so it only (re)plays once per win screen, exactly like the
 * reference's `winSpawned` flag (see ShuntingBoard/ClassificationBoard).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Group, Rect } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';

import { motion } from '../../../design/tokens';

export interface ConfettiProps {
  cx: number;
  cy: number;
  active: boolean;
  count?: number;
}

interface ParticleSeed {
  x0: number;
  y0: number;
  vx0: number;
  vy0: number;
  w: number;
  h: number;
  hue: number;
  rot0: number;
  rotV: number;
  decayPerSec: number;
}

/** Per-frame velocity damping (ref: `p.vx *= 0.99`) expressed as a continuous decay rate at 60fps. */
const DAMPING_K = -60 * Math.log(0.99);
/** Gravity (ref: `p.vy += 0.32` px/frame at 60fps) in px/s². */
const GRAVITY = 0.32 * 60 * 60;

function makeSeed(cx: number, cy: number): ParticleSeed {
  const angle = (Math.random() - 0.5) * Math.PI * 2;
  const speed = Math.random() * 14 + 3; // px/frame
  return {
    x0: cx + (Math.random() - 0.5) * 300,
    y0: cy + (Math.random() - 0.5) * 100,
    vx0: Math.cos(angle) * speed * 60,
    vy0: (Math.sin(angle) * speed - 7) * 60,
    w: Math.random() * 9 + 4,
    h: Math.random() * 5 + 3,
    hue: Math.floor(Math.random() * 360),
    rot0: Math.random() * Math.PI * 2,
    rotV: (Math.random() - 0.5) * 0.25 * 60,
    decayPerSec: (Math.random() * 0.008 + 0.004) * 60,
  };
}

function hsl(h: number): string {
  return `hsl(${h}, 90%, 65%)`;
}

function ConfettiParticle({ seed, tMs }: { seed: ParticleSeed; tMs: ReturnType<typeof useSharedValue<number>> }) {
  const transform = useDerivedValue(() => {
    const t = tMs.value / 1000;
    const x = seed.x0 + (seed.vx0 / DAMPING_K) * (1 - Math.exp(-DAMPING_K * t));
    const y = seed.y0 + seed.vy0 * t + 0.5 * GRAVITY * t * t;
    const rot = seed.rot0 + seed.rotV * t;
    return [{ translateX: x }, { translateY: y }, { rotate: rot }];
  }, [tMs]);

  const opacity = useDerivedValue(() => {
    const t = tMs.value / 1000;
    const life = Math.max(0, 1 - seed.decayPerSec * t);
    return Math.min(life * 2, 1);
  }, [tMs]);

  return (
    <Group transform={transform} opacity={opacity}>
      <Rect x={-seed.w / 2} y={-seed.h / 2} width={seed.w} height={seed.h} color={hsl(seed.hue)} />
    </Group>
  );
}

// Hard cap regardless of what a caller passes — this is a burst effect, not
// a simulation; the reference stepped ~160 particles/frame on the JS thread,
// but even our closed-form UI-thread version still means this many Rect+
// Group nodes sit in the Canvas's picture and get repainted every animated
// frame for the ~1.2s the burst runs. 48 reads as a full burst at the sizes
// this game renders at while keeping the win-screen frame cheap on low-end
// GPUs (see the perf-pass notes in design/design-system.md §5.3).
const MAX_PARTICLES = 48;

function ConfettiImpl({ cx, cy, active, count = MAX_PARTICLES }: ConfettiProps) {
  const clampedCount = Math.min(count, MAX_PARTICLES);
  const tMs = useSharedValue(0);
  const seeds = useMemo(() => Array.from({ length: clampedCount }, () => makeSeed(cx, cy)), [cx, cy, clampedCount]);
  // Tracks whether the burst has fully played out so the component can
  // unmount its (48 × several Skia nodes) tree instead of leaving it sitting
  // idle in the Canvas picture for as long as the caller keeps `active` true
  // (win/summary screens currently leave `showCelebration` on indefinitely —
  // see boardContract.ts). Once `done`, we render null: nothing left to
  // animate or repaint, and the nodes are actually freed.
  const [done, setDone] = useState(!active);

  useEffect(() => {
    if (!active) {
      setDone(true);
      return;
    }
    setDone(false);
    tMs.value = 0;
    tMs.value = withTiming(motion.durations.confetti, { duration: motion.durations.confetti, easing: Easing.linear });
    const id = setTimeout(() => setDone(true), motion.durations.confetti + 120);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active || done) return null;

  return (
    <Group>
      {seeds.map((seed, i) => (
        <ConfettiParticle key={i} seed={seed} tMs={tMs} />
      ))}
    </Group>
  );
}

export const Confetti = React.memo(ConfettiImpl);
