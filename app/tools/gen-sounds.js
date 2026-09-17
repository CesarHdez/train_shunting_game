#!/usr/bin/env node
/**
 * tools/gen-sounds.js
 *
 * Procedurally synthesizes every SFX used by src/audio/sounds.ts and writes
 * them as 16-bit PCM mono 44.1kHz WAV files into assets/sounds/. No external
 * audio assets are downloaded or embedded — every waveform below is built
 * from simple oscillators/noise + envelopes, kept gentle (normalized well
 * below full scale) so nothing clips or sounds harsh.
 *
 * Usage: node tools/gen-sounds.js
 * Safe to re-run — always (re)writes the same 7 files. Noise-based layers
 * use Math.random(), so exact sample values differ slightly between runs,
 * but duration/character/amplitude are deterministic.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'sounds');

// ─────────────────────────────────────────────────────────────────────────
// Low-level DSP helpers
// ─────────────────────────────────────────────────────────────────────────

/** Allocates `seconds` worth of silent samples. */
function buffer(seconds) {
  return new Float32Array(Math.max(1, Math.round(seconds * SAMPLE_RATE)));
}

/** Pure sine tone at a fixed `freq` Hz for the buffer's whole duration. */
function sine(seconds, freq, amp = 1) {
  const out = buffer(seconds);
  for (let i = 0; i < out.length; i++) {
    out[i] = amp * Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE);
  }
  return out;
}

/**
 * Sine sweep from `f0` to `f1` Hz over `curveSeconds`, then held at `f1`.
 * Uses phase accumulation (integrates instantaneous frequency) rather than
 * `sin(2*pi*f(t)*t)` so the sweep has no phase discontinuity/click.
 */
function chirp(seconds, f0, f1, amp, curveSeconds) {
  const out = buffer(seconds);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    const freq = t < curveSeconds ? f0 + (f1 - f0) * (t / curveSeconds) : f1;
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    out[i] = amp * Math.sin(phase);
  }
  return out;
}

/** White noise in [-amp, amp]. */
function noise(seconds, amp = 1) {
  const out = buffer(seconds);
  for (let i = 0; i < out.length; i++) out[i] = amp * (Math.random() * 2 - 1);
  return out;
}

/** Exponential decay envelope: 1 at t=0, ~e^-1 at t=tau. */
function expDecay(samples, tau) {
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    out[i] = samples[i] * Math.exp(-t / tau);
  }
  return out;
}

/** Linear-attack / exponential-release envelope ("pluck" shape). */
function attackDecay(samples, attackSeconds, tau) {
  const attackSamples = Math.max(1, Math.round(attackSeconds * SAMPLE_RATE));
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    const attack = i < attackSamples ? i / attackSamples : 1;
    const decay = Math.exp(-Math.max(0, t - attackSeconds) / tau);
    out[i] = samples[i] * attack * decay;
  }
  return out;
}

/** One-pole low-pass — softens harsh/hissy noise into a gentler "thump"/"clack". */
function lowpass(samples, alpha = 0.2) {
  const out = new Float32Array(samples.length);
  let prev = 0;
  for (let i = 0; i < samples.length; i++) {
    prev = prev + alpha * (samples[i] - prev);
    out[i] = prev;
  }
  return out;
}

/** Gentle tanh soft-clip — adds a bit of harmonic "buzz" without harsh digital clipping. */
function softClip(samples, drive = 2) {
  const out = new Float32Array(samples.length);
  const norm = Math.tanh(drive);
  for (let i = 0; i < samples.length; i++) out[i] = Math.tanh(samples[i] * drive) / norm;
  return out;
}

/** Sums `parts` (each `{ samples, offsetSeconds }`) into a `totalSeconds`-long buffer. */
function mixAt(totalSeconds, parts) {
  const out = buffer(totalSeconds);
  for (const { samples, offsetSeconds = 0 } of parts) {
    const offset = Math.round(offsetSeconds * SAMPLE_RATE);
    for (let i = 0; i < samples.length; i++) {
      const j = offset + i;
      if (j >= 0 && j < out.length) out[j] += samples[i];
    }
  }
  return out;
}

/** Scales `samples` so its peak absolute value equals `peak` — keeps everything clip-free. */
function normalize(samples, peak = 0.7) {
  let max = 0;
  for (let i = 0; i < samples.length; i++) max = Math.max(max, Math.abs(samples[i]));
  if (max < 1e-6) return samples;
  const scale = peak / max;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * scale;
  return out;
}

/** A few-ms linear fade in/out at the buffer edges — avoids sample-0/-N "pop" clicks. */
function fadeEdges(samples, ms = 3) {
  const n = Math.min(samples.length >> 1, Math.round((ms / 1000) * SAMPLE_RATE));
  const out = Float32Array.from(samples);
  for (let i = 0; i < n; i++) {
    const g = i / n;
    out[i] *= g;
    out[out.length - 1 - i] *= g;
  }
  return out;
}

/** Writes a mono 16-bit PCM WAV file from float samples in [-1, 1]. */
function writeWav(filePath, samples) {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16); // fmt chunk size (PCM)
  buf.writeUInt16LE(1, 20); // audio format: PCM
  buf.writeUInt16LE(1, 22); // channels: mono
  buf.writeUInt32LE(SAMPLE_RATE, 24); // sample rate
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate (mono * 16-bit)
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filePath, buf);
}

// ─────────────────────────────────────────────────────────────────────────
// Individual SFX — each ≤ ~0.5s, gentle amplitude, tasteful (not harsh).
// ─────────────────────────────────────────────────────────────────────────

/** select.wav — very short soft click (car/arrival selection). */
function genSelect() {
  const dur = 0.05;
  const body = mixAt(dur, [
    { samples: expDecay(lowpass(noise(dur, 0.6), 0.5), 0.006) },
    { samples: expDecay(sine(dur, 1900, 0.35), 0.007) },
  ]);
  return fadeEdges(normalize(body, 0.3));
}

/** place.wav — short low thunk (locomotive placed on a track). */
function genPlace() {
  const dur = 0.2;
  const body = mixAt(dur, [
    { samples: attackDecay(sine(dur, 95, 1), 0.003, 0.055) },
    { samples: attackDecay(sine(dur, 52, 0.5), 0.003, 0.06) },
    { samples: expDecay(lowpass(noise(0.03, 0.8), 0.35), 0.006) },
  ]);
  return fadeEdges(normalize(body, 0.6));
}

/** move.wav — soft "coupling clack" for a wagon move: two short noise/thump blips. */
function genMove() {
  const dur = 0.16;
  const blip = (amp) => expDecay(lowpass(noise(0.035, amp), 0.4), 0.012);
  const body = mixAt(dur, [
    { samples: blip(0.9), offsetSeconds: 0 },
    { samples: attackDecay(sine(0.035, 180, 0.5), 0.001, 0.015), offsetSeconds: 0 },
    { samples: blip(0.6), offsetSeconds: 0.075 },
    { samples: attackDecay(sine(0.035, 150, 0.35), 0.001, 0.015), offsetSeconds: 0.075 },
  ]);
  return fadeEdges(normalize(body, 0.55));
}

/** reject.wav — short low buzz (invalid move / vía llena). */
function genReject() {
  const dur = 0.26;
  const raw = mixAt(dur, [
    { samples: sine(dur, 108, 0.7) },
    { samples: sine(dur, 114, 0.6) }, // close detune -> gentle "buzzy" beating
  ]);
  const buzzed = softClip(raw, 1.6);
  const shaped = attackDecay(buzzed, 0.01, 0.12);
  return fadeEdges(normalize(shaped, 0.4));
}

/** push.wav — short click-thump (classification push). */
function genPush() {
  const dur = 0.15;
  const body = mixAt(dur, [
    { samples: expDecay(lowpass(noise(0.02, 0.7), 0.55), 0.005), offsetSeconds: 0 },
    { samples: attackDecay(sine(0.12, 100, 0.9), 0.002, 0.045), offsetSeconds: 0.012 },
  ]);
  return fadeEdges(normalize(body, 0.55));
}

/** A single bell-like note (fundamental + two soft overtones) used by win.wav. */
function bellNote(freq, seconds, amp) {
  const fundamental = sine(seconds, freq, amp);
  const overtone = sine(seconds, freq * 2, amp * 0.35);
  const sparkle = sine(seconds, freq * 3, amp * 0.12);
  return attackDecay(
    mixAt(seconds, [{ samples: fundamental }, { samples: overtone }, { samples: sparkle }]),
    0.006,
    0.14
  );
}

/** win.wav — pleasant rising 3-note arpeggio chime (level won / summary). */
function genWin() {
  const noteDur = 0.22;
  const spacing = 0.11;
  const total = spacing * 2 + noteDur + 0.03; // small tail margin so the last note's decay isn't cut
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 — bright, resolved-feeling rise
  const parts = notes.map((f, i) => ({ samples: bellNote(f, noteDur, 0.5), offsetSeconds: i * spacing }));
  return fadeEdges(normalize(mixAt(total, parts), 0.55));
}

/** star.wav — tiny sparkle ping (new record). */
function genStar() {
  const dur = 0.2;
  const sweep = attackDecay(chirp(dur, 1900, 2800, 1, 0.05), 0.004, 0.09);
  const shimmer = mixAt(dur, [
    { samples: sweep },
    { samples: attackDecay(sine(0.1, 3600, 0.3), 0.004, 0.06), offsetSeconds: 0.015 },
  ]);
  return fadeEdges(normalize(shimmer, 0.4));
}

// ─────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────

const SOUNDS = {
  'select.wav': genSelect,
  'place.wav': genPlace,
  'move.wav': genMove,
  'reject.wav': genReject,
  'push.wav': genPush,
  'win.wav': genWin,
  'star.wav': genStar,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [file, gen] of Object.entries(SOUNDS)) {
  const samples = gen();
  writeWav(path.join(OUT_DIR, file), samples);
  console.log(`wrote ${file} (${(samples.length / SAMPLE_RATE).toFixed(3)}s, ${samples.length} samples)`);
}
console.log(`\nDone. ${Object.keys(SOUNDS).length} files written to ${OUT_DIR}`);
