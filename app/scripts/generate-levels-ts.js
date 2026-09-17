#!/usr/bin/env node
/**
 * generate-levels-ts.js
 *
 * One-shot codegen: reads all shunting (1..100) and classification (1..10)
 * level JSON files from app/assets/levels/** and emits app/src/data/levels.ts
 * with a static import for every file (Metro/TypeScript cannot resolve
 * dynamic-path requires) plus a small typed lookup API.
 *
 * Run with: node scripts/generate-levels-ts.js
 * Safe to re-run any time the level JSON files change (it does not read or
 * alter level content itself — it only lists directories and writes the
 * generated TS file).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SHUNTING_DIR = path.join(ROOT, 'assets', 'levels', 'shunting');
const CLASSIFICATION_DIR = path.join(ROOT, 'assets', 'levels', 'classification');
const OUT_FILE = path.join(ROOT, 'src', 'data', 'levels.ts');

function listLevelFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => /^level_\d+\.json$/.test(f))
    .map((f) => ({
      file: f,
      id: Number(f.match(/^level_(\d+)\.json$/)[1]),
    }))
    .sort((a, b) => a.id - b.id);
}

const shuntingFiles = listLevelFiles(SHUNTING_DIR);
const classificationFiles = listLevelFiles(CLASSIFICATION_DIR);

function assertContiguous(entries, name, expectedCount) {
  if (entries.length !== expectedCount) {
    throw new Error(`${name}: expected ${expectedCount} files, found ${entries.length}`);
  }
  entries.forEach((e, i) => {
    const expectedId = i + 1;
    if (e.id !== expectedId) {
      throw new Error(`${name}: expected id ${expectedId} at position ${i}, found ${e.id} (${e.file})`);
    }
  });
}

assertContiguous(shuntingFiles, 'shunting', 100);
assertContiguous(classificationFiles, 'classification', 10);

function importName(prefix, id) {
  return `${prefix}${id}`;
}

const lines = [];

lines.push('/**');
lines.push(' * AUTO-GENERATED — do not edit by hand.');
lines.push(' * Regenerate with: node scripts/generate-levels-ts.js');
lines.push(' *');
lines.push(' * Statically imports every bundled level JSON (Metro cannot resolve');
lines.push(' * dynamic-path requires) and exposes a small typed lookup API that');
lines.push(' * conforms to the shared contract in ./levelTypes.');
lines.push(' */');
lines.push('');
lines.push("import type { ShuntingLevel, ClassificationLevel } from './levelTypes';");
lines.push('');

// Shunting imports
for (const { file, id } of shuntingFiles) {
  lines.push(
    `import ${importName('s', id)} from '../../assets/levels/shunting/${file}';`
  );
}
lines.push('');
// Classification imports
for (const { file, id } of classificationFiles) {
  lines.push(
    `import ${importName('c', id)} from '../../assets/levels/classification/${file}';`
  );
}
lines.push('');

lines.push('const shuntingLevels: ShuntingLevel[] = [');
for (const { id } of shuntingFiles) {
  lines.push(`  ${importName('s', id)} as unknown as ShuntingLevel,`);
}
lines.push('];');
lines.push('');

lines.push('const classificationLevels: ClassificationLevel[] = [');
for (const { id } of classificationFiles) {
  lines.push(`  ${importName('c', id)} as unknown as ClassificationLevel,`);
}
lines.push('];');
lines.push('');

lines.push('const shuntingById = new Map<number, ShuntingLevel>(');
lines.push('  shuntingLevels.map((level) => [level.id, level])');
lines.push(');');
lines.push('');
lines.push('const classificationById = new Map<number, ClassificationLevel>(');
lines.push('  classificationLevels.map((level) => [level.id, level])');
lines.push(');');
lines.push('');

lines.push('/** Total number of bundled shunting levels. */');
lines.push(`export const shuntingLevelCount = ${shuntingFiles.length};`);
lines.push('');
lines.push('/** Total number of bundled classification levels. */');
lines.push(`export const classificationLevelCount = ${classificationFiles.length};`);
lines.push('');

lines.push('/** Look up a shunting level by id (1-based). Returns undefined if not found. */');
lines.push('export function getShuntingLevel(id: number): ShuntingLevel | undefined {');
lines.push('  return shuntingById.get(id);');
lines.push('}');
lines.push('');

lines.push('/** Look up a classification level by id (1-based). Returns undefined if not found. */');
lines.push('export function getClassificationLevel(id: number): ClassificationLevel | undefined {');
lines.push('  return classificationById.get(id);');
lines.push('}');
lines.push('');

lines.push('/** All bundled shunting levels, ordered by id ascending. */');
lines.push('export function allShuntingLevels(): ShuntingLevel[] {');
lines.push('  return shuntingLevels;');
lines.push('}');
lines.push('');

lines.push('/** All bundled classification levels, ordered by id ascending. */');
lines.push('export function allClassificationLevels(): ClassificationLevel[] {');
lines.push('  return classificationLevels;');
lines.push('}');
lines.push('');

fs.writeFileSync(OUT_FILE, lines.join('\n'), 'utf8');

console.log(
  `Wrote ${OUT_FILE} with ${shuntingFiles.length} shunting + ${classificationFiles.length} classification level imports.`
);
