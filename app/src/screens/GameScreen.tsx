import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, radii, spacing, typeScaleMenu, withAlpha } from '../../design/tokens';
import TopBar from '../components/hud/TopBar';
import { ObjectiveBarShunting, ObjectiveBarClassification } from '../components/hud/ObjectiveBar';
import BottomBar from '../components/hud/BottomBar';
import Toast from '../components/hud/Toast';
import TutorialOverlay from '../components/TutorialOverlay';
import RightLocoHint from '../components/RightLocoHint';
import WinSummaryCard from '../components/WinSummaryCard';
import ResultsChip from '../components/ResultsChip';
import { TrophyIcon } from '../components/icons';
import { formatTime, readableIdentityColor, starsGlyph } from '../components/copy';
import { useShuntingController } from '../controller/shuntingController';
import { useClassificationController } from '../controller/classificationController';
import { usePlayer } from '../controller/PlayerContext';
import { getShuntingLevel, getClassificationLevel } from '../data/levels';
import { parseClassificationCar } from '../data/levelTypes';
import { calcularPuntaje } from '../engine/classification';
import { CLF_TUTORIAL_MODALS, CLF_TUTORIAL_MODAL_COPY, clfTutorialHintText } from '../controller/tutorial';
// The renderer agent owns these — see boardContract.ts. Filenames assumed
// per the existing src/render/ layout (boardContract.ts sits alongside).
// If the renderer lands them under different names, update these two
// imports only — nothing else in this file depends on the exact path.
import { ShuntingBoard } from '../render/ShuntingBoard';
import { ClassificationBoard } from '../render/ClassificationBoard';
import { usePalette } from '../render/iso/timeOfDay';
import type { RootScreenProps } from '../navigation/types';

type CanvasSize = { width: number; height: number };

function useCanvasLayout() {
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };
  return { size, onLayout };
}

/**
 * True on a landscape-shaped window (width > height) — the app is
 * landscape-locked (see app.json), but this still distinguishes the common
 * wide/short phone shape from the rare tall/narrow case (foldables,
 * multi-window/split-screen) where the portrait HUD is the safer fallback.
 * Drives the compact single-row HUD (TopBar/ObjectiveBar `compact` prop) and
 * dropping the full-width BottomBar — see the two screens below.
 */
function useIsLandscape() {
  const { width, height } = useWindowDimensions();
  return width > height;
}

export default function GameScreen({ route, navigation }: RootScreenProps<'Game'>) {
  const { mode, levelId } = route.params;
  return mode === 'shunting' ? (
    <ShuntingGameScreen levelId={levelId} navigation={navigation} />
  ) : (
    <ClassificationGameScreen levelId={levelId} navigation={navigation} />
  );
}

// ─────────────────────────── SHUNTING ────────────────────────────

function ShuntingGameScreen({
  levelId,
  navigation,
}: {
  levelId: number;
  navigation: RootScreenProps<'Game'>['navigation'];
}) {
  const insets = useSafeAreaInsets();
  const { playerName } = usePlayer();
  const ctrl = useShuntingController(levelId, playerName);
  const { size: canvasSize, onLayout } = useCanvasLayout();
  const isLandscape = useIsLandscape();
  const palette = usePalette();
  // Whatever letterboxing is left around the board should read as more sky,
  // not as the old dark chrome sitting behind a lit yard.
  const skyTop = palette.sky.colors[0];
  // Cap the canvas the board lays out against so a large tablet or wide
  // landscape window doesn't sprawl the yard toward the screen edges — see
  // layout.playAreaMaxWidth/Height doc comment. `body`'s alignItems/
  // justifyContent:'center' (below) then centers the (possibly smaller)
  // board within any leftover space. On phones both mins are always the
  // uncapped canvas size, so this is a no-op there.
  const boardWidth = canvasSize.width > 0 ? Math.min(canvasSize.width, layout.playAreaMaxWidth) : 0;
  const boardHeight = canvasSize.height > 0 ? Math.min(canvasSize.height, layout.playAreaMaxHeight) : 0;

  const goMenu = () => navigation.navigate('LevelSelect', { mode: 'shunting' });

  const locoLimitBadge = isFinite(ctrl.state.locoLimit)
    ? `MÁX ${ctrl.state.locoLimit} VAGÓN${ctrl.state.locoLimit > 1 ? 'ES' : ''} / MANIOBRA`
    : null;

  const scoreStr = ctrl.scoreResult ? ` · ${ctrl.scoreResult.score} pts` : '';
  const hasNext = !!getShuntingLevel(levelId + 1);
  const isOptimal = ctrl.state.minMoves != null && ctrl.state.moves === ctrl.state.minMoves;
  // The medal-gold "¡ÓPTIMO!" pill sits on the win card's own surface, which
  // is now the active pass's `hud.buttonBg` (see WinSummaryCard.tsx) instead
  // of a permanently-dark fill — on mediodia's light glass, plain
  // `colors.medal.gold` reads as pale-on-pale, so it goes through the same
  // WCAG-contrast fix as the leaderboard's medal rows and the win card's
  // record pill.
  const optimalInk = readableIdentityColor(colors.medal.gold, palette.hud.text);

  const boardLabel = `Tablero de maniobras. Objetivo: ${ctrl.state.target.join(' ')}. Maniobras: ${ctrl.state.moves}.`;

  const shareText = ctrl.scoreResult
    ? `Completé el Nivel ${levelId} de Patio de Trenes en ${ctrl.state.moves} maniobras (${ctrl.scoreResult.score} pts, ${starsGlyph(ctrl.scoreResult.stars)}).`
    : null;

  return (
    <View style={[styles.background, { backgroundColor: skyTop }]}>
      <TopBar
        levelLabel={`NIVEL ${levelId}`}
        locoLimitBadge={locoLimitBadge}
        timeStr={formatTime(ctrl.elapsedSeconds)}
        rightLabel="MANIOBRAS"
        rightValue={String(ctrl.state.moves)}
        onMenu={goMenu}
        onRestart={ctrl.restart}
        onUndo={ctrl.undo}
        canUndo={ctrl.canUndo}
        insetTop={insets.top}
        compact={isLandscape}
      />
      <ObjectiveBarShunting target={ctrl.state.target} compact={isLandscape} />

      <View style={styles.body} onLayout={onLayout}>
        {canvasSize.width > 0 && canvasSize.height > 0 ? (
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={boardLabel}
          >
            <ShuntingBoard
              state={ctrl.state}
              prevState={ctrl.prevState}
              width={boardWidth}
              height={boardHeight}
              onAnimationComplete={ctrl.onBoardAnimationComplete}
              showCelebration={ctrl.summaryVisible}
              {...ctrl.boardEvents}
            />
          </View>
        ) : null}
        <TutorialOverlay step={ctrl.tutorialStep} onAdvanceModal={ctrl.tutorialAdvanceModal} onSkip={ctrl.tutorialSkip} />
        <RightLocoHint visible={ctrl.showRightLocoHint} onDismiss={ctrl.dismissRightLocoHint} />
        <ResultsChip visible={ctrl.canReopenSummary} onPress={ctrl.reopenSummary} />
        <Toast message={ctrl.toastMessage} bottomOffset={spacing.sm} />
      </View>

      {/* Dropped in landscape — undo already lives in the compact TopBar row
          above, and reclaiming this full-width bar's height goes straight
          to the board. See TopBar's `compact` prop / useIsLandscape above. */}
      {!isLandscape ? <BottomBar onUndo={ctrl.undo} canUndo={ctrl.canUndo} insetBottom={insets.bottom} /> : null}

      <WinSummaryCard
        visible={ctrl.summaryVisible}
        onDismiss={ctrl.dismissSummary}
        title={`¡NIVEL ${levelId} COMPLETADO!`}
        stars={ctrl.scoreResult?.stars ?? 1}
        isNewRecord={ctrl.scoreResult?.isNewRecord ?? false}
        headerLabel={
          ctrl.globalLeaderboard.length
            ? `RANKING GLOBAL — NIVEL ${levelId}`
            : `PUNTAJES — NIVEL ${levelId}`
        }
        isGlobalBoard={ctrl.globalLeaderboard.length > 0}
        leaderboardEntries={ctrl.globalLeaderboard.length ? ctrl.globalLeaderboard : ctrl.localLeaderboard}
        leaderboardLoading={false}
        highlightRank={ctrl.globalLeaderboard.length ? null : ctrl.scoreResult?.rank ?? null}
        hasNextLevel={hasNext}
        borderTint="rgba(105,240,174,0.3)"
        offline={ctrl.offline}
        shareText={shareText}
        onRepeat={ctrl.restart}
        onMenu={goMenu}
        onNext={() => navigation.replace('Game', { mode: 'shunting', levelId: levelId + 1 })}
      >
        {ctrl.state.minMoves != null ? (
          isOptimal ? (
            <View
              style={[
                styles.optimalPill,
                { backgroundColor: withAlpha(optimalInk, 0.14), borderColor: withAlpha(optimalInk, 0.55) },
              ]}
            >
              <TrophyIcon size={14} color={optimalInk} />
              <Text style={[styles.optimalPillText, { color: optimalInk }]} maxFontSizeMultiplier={1.3}>
                ¡ÓPTIMO!
              </Text>
            </View>
          ) : (
            <Text style={[styles.optimalLine, { color: palette.hud.accent }]} maxFontSizeMultiplier={1.3}>
              Óptimo: {ctrl.state.minMoves} · Tu resultado: {ctrl.state.moves}
            </Text>
          )
        ) : null}
        <Text style={[styles.statsLine, { color: palette.hud.textDim }]} maxFontSizeMultiplier={1.3}>
          MANIOBRAS: {ctrl.state.moves} · TIEMPO: {formatTime(ctrl.elapsedSeconds)}
          {scoreStr}
        </Text>
      </WinSummaryCard>
    </View>
  );
}

// ───────────────────────── CLASSIFICATION ────────────────────────

function ClassificationGameScreen({
  levelId,
  navigation,
}: {
  levelId: number;
  navigation: RootScreenProps<'Game'>['navigation'];
}) {
  const insets = useSafeAreaInsets();
  const { playerName } = usePlayer();
  const ctrl = useClassificationController(levelId, playerName);
  const { size: canvasSize, onLayout } = useCanvasLayout();
  const isLandscape = useIsLandscape();
  const level = getClassificationLevel(levelId);
  const palette = usePalette();
  const skyTop = palette.sky.colors[0];
  // See ShuntingGameScreen's identical boardWidth/boardHeight comment above.
  const boardWidth = canvasSize.width > 0 ? Math.min(canvasSize.width, layout.playAreaMaxWidth) : 0;
  const boardHeight = canvasSize.height > 0 ? Math.min(canvasSize.height, layout.playAreaMaxHeight) : 0;

  const goMenu = () => navigation.navigate('LevelSelect', { mode: 'classification' });

  const selectedArrival = ctrl.state.arrivals[ctrl.state.viaSel];
  const nextCar = selectedArrival && selectedArrival.length > 0 ? selectedArrival[0] : null;
  const next = nextCar ? parseClassificationCar(nextCar) : null;

  const hasNext = !!getClassificationLevel(levelId + 1);
  const breakdown = ctrl.state.lastResult;
  // Live "PUNTOS" readout while PLAYING — mirrors ref's `clf.parcial()`.
  const partialPoints = ctrl.state.lastResult?.puntos ?? calcularPuntaje(ctrl.state.clasif).puntos;
  const remainingCount = ctrl.state.arrivals.reduce((a, v) => a + v.length, 0);

  const boardLabel = `Patio de clasificación. Por clasificar: ${remainingCount}.`;

  const shareText = ctrl.scoreResult
    ? `Turno ${levelId}: ${ctrl.scoreResult.score}/${ctrl.scoreResult.max} puntos (${starsGlyph(ctrl.scoreResult.stars)}) en Patio de Trenes.`
    : null;

  return (
    <View style={[styles.background, { backgroundColor: skyTop }]}>
      <TopBar
        levelLabel={`TURNO ${levelId}`}
        locoLimitBadge={null}
        timeStr={formatTime(ctrl.elapsedSeconds)}
        rightLabel="PUNTOS"
        rightValue={String(partialPoints)}
        rightValueColor={palette.hud.statWarning}
        extraStatLabel="SALTOS"
        extraStatValue={String(ctrl.saltos)}
        extraStatColor={ctrl.saltos > 0 ? palette.hud.statWarning : palette.hud.statSuccess}
        pointsDelta={ctrl.lastPointsDelta}
        onMenu={goMenu}
        onRestart={ctrl.restart}
        onUndo={ctrl.undo}
        canUndo={ctrl.canUndo}
        insetTop={insets.top}
        compact={isLandscape}
      />
      <ObjectiveBarClassification
        levelName={level?.name ?? ''}
        remaining={remainingCount}
        next={next}
        compact={isLandscape}
      />

      <View style={styles.body} onLayout={onLayout}>
        {canvasSize.width > 0 && canvasSize.height > 0 ? (
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={boardLabel}
          >
            <ClassificationBoard
              state={ctrl.state}
              prevState={ctrl.prevState}
              width={boardWidth}
              height={boardHeight}
              onAnimationComplete={ctrl.onBoardAnimationComplete}
              showCelebration={ctrl.summaryVisible}
              {...ctrl.boardEvents}
            />
          </View>
        ) : null}
        <TutorialOverlay
          step={ctrl.tutorialStep}
          onAdvanceModal={ctrl.tutorialAdvanceModal}
          onSkip={ctrl.tutorialSkip}
          modals={CLF_TUTORIAL_MODALS}
          hintText={clfTutorialHintText}
          skipLabel={CLF_TUTORIAL_MODAL_COPY.skipLabel}
        />
        <ResultsChip visible={ctrl.canReopenSummary} onPress={ctrl.reopenSummary} />
        <Toast message={ctrl.toastMessage} bottomOffset={spacing.sm} />
      </View>

      {!isLandscape ? <BottomBar onUndo={ctrl.undo} canUndo={ctrl.canUndo} insetBottom={insets.bottom} /> : null}

      <WinSummaryCard
        visible={ctrl.summaryVisible}
        onDismiss={ctrl.dismissSummary}
        title={level?.name ?? `TURNO ${levelId}`}
        stars={ctrl.scoreResult?.stars ?? 1}
        isNewRecord={ctrl.scoreResult?.isNewRecord ?? false}
        headerLabel={
          ctrl.globalLeaderboard.length ? `RANKING GLOBAL — TURNO ${levelId}` : `PUNTAJES — TURNO ${levelId}`
        }
        isGlobalBoard={ctrl.globalLeaderboard.length > 0}
        leaderboardEntries={ctrl.globalLeaderboard.length ? ctrl.globalLeaderboard : ctrl.localLeaderboard}
        leaderboardLoading={false}
        highlightRank={ctrl.globalLeaderboard.length ? null : ctrl.scoreResult?.rank ?? null}
        hasNextLevel={hasNext}
        borderTint="rgba(245,166,35,0.35)"
        offline={ctrl.offline}
        shareText={shareText}
        onRepeat={ctrl.restart}
        onMenu={goMenu}
        onNext={() => navigation.replace('Game', { mode: 'classification', levelId: levelId + 1 })}
      >
        {breakdown ? (
          <>
            <Text style={[styles.bigScore, { color: palette.hud.statWarning }]} maxFontSizeMultiplier={1.3}>
              {breakdown.puntos}
            </Text>
            <Text style={[styles.subScore, { color: palette.hud.textDim }]} maxFontSizeMultiplier={1.3}>
              de {ctrl.scoreResult?.max ?? breakdown.puntos} posibles · TIEMPO: {formatTime(ctrl.elapsedSeconds)}
            </Text>
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: palette.hud.text }]} maxFontSizeMultiplier={1.3}>
                Carros clasificados
              </Text>
              <Text style={[styles.breakdownValue, { color: palette.hud.text }]} maxFontSizeMultiplier={1.3}>
                +{breakdown.carros * 10}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text
                style={[styles.breakdownLabel, { color: breakdown.saltos ? palette.hud.statWarning : palette.hud.textDim }]}
                maxFontSizeMultiplier={1.3}
              >
                Saltos de color ({breakdown.saltos})
              </Text>
              <Text
                style={[styles.breakdownValue, { color: breakdown.saltos ? palette.hud.statWarning : palette.hud.textDim }]}
                maxFontSizeMultiplier={1.3}
              >
                −{breakdown.saltos * 15}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: palette.hud.statSuccess }]} maxFontSizeMultiplier={1.3}>
                Vías de un solo color
              </Text>
              <Text style={[styles.breakdownValue, { color: palette.hud.statSuccess }]} maxFontSizeMultiplier={1.3}>
                +{breakdown.purasBonus}
              </Text>
            </View>
          </>
        ) : null}
      </WinSummaryCard>
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: colors.background.gradientTop,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    // Centers the board when its (capped) size is smaller than the
    // available body — see boardWidth/boardHeight above. A no-op on phones,
    // where the board always exactly fills body (nothing to center within).
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsLine: {
    ...typeScaleMenu.bodySmall,
    textAlign: 'center',
  },
  optimalLine: {
    ...typeScaleMenu.body,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  optimalPill: {
    alignSelf: 'center',
    height: 26,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  optimalPillText: {
    ...typeScaleMenu.bodySmall,
    fontWeight: '700',
  },
  bigScore: {
    ...typeScaleMenu.numericLarge,
    textAlign: 'center',
  },
  subScore: {
    ...typeScaleMenu.bodySmall,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 21,
    alignItems: 'center',
  },
  breakdownLabel: {
    ...typeScaleMenu.body,
  },
  breakdownValue: {
    ...typeScaleMenu.body,
    fontWeight: '700',
  },
});
