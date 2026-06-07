import type { Player, Tile } from './types';

export type RunnerPoint = {
  left: number;
  top: number;
};

export const serverPresentationBufferMs = 420;
export const maxVisualAuthorityLeadCursor = 1.18;
export const hardVisualCorrectionCursor = 0.75;
export const maxVisualFrameStepMs = 48;
export const fallbackVisualSegmentDurationMs = 800;

export function tileCenter(tile: Tile): RunnerPoint {
  return {
    left: ((tile.coord[0] + 0.5) / 5) * 100,
    top: ((tile.coord[1] + 0.5) / 5) * 100
  };
}

export function pointAlongBoard(board: Tile[], cursor: number): RunnerPoint {
  if (!board.length) return { left: 50, top: 50 };
  const boardLength = board.length;
  const normalized = ((cursor % boardLength) + boardLength) % boardLength;
  const fromIndex = Math.floor(normalized) % boardLength;
  const toIndex = (fromIndex + 1) % boardLength;
  const mix = normalized - Math.floor(normalized);
  const start = tileCenter(board[fromIndex] ?? board[0]);
  const end = tileCenter(board[toIndex] ?? board[fromIndex] ?? board[0]);

  return {
    left: start.left + (end.left - start.left) * mix,
    top: start.top + (end.top - start.top) * mix
  };
}

export function serverPresentationClock(serverNow: number, receivedAt?: number, bufferMs = serverPresentationBufferMs) {
  return serverNow + (receivedAt ? Date.now() - receivedAt : 0) - bufferMs;
}

function segmentCursor(segment: NonNullable<Player['nextMovement']>, serverClock: number) {
  const durationMs = Math.max(1, segment.arriveAt - segment.departAt);
  const progress = Math.max(0, Math.min(1, (serverClock - segment.departAt) / durationMs));
  return segment.fromCursor + (segment.toCursor - segment.fromCursor) * progress;
}

export function visualSegmentDurationMs(segment: Player['nextMovement'] | Player['arrivalMovement']) {
  if (!segment) return fallbackVisualSegmentDurationMs;
  const durationMs = segment.arriveAt - segment.departAt;
  return Number.isFinite(durationMs) && durationMs > 0 ? durationMs : fallbackVisualSegmentDurationMs;
}

function tileAtCursor(board: Tile[], cursor: number) {
  if (!board.length) return null;
  const boardLength = board.length;
  const index = Math.floor(((cursor % boardLength) + boardLength) % boardLength);
  return board[index] ?? null;
}

function blocksContinuousMovement(board: Tile[], cursor: number) {
  const tile = tileAtCursor(board, cursor);
  return tile?.movementStopKind === 'combat';
}

function cursorHasMovementStop(board: Tile[], cursor: number) {
  return Math.abs(cursor - Math.round(cursor)) < 0.0001 && blocksContinuousMovement(board, cursor);
}

function visualMovementStopCursor(_board: Tile[], cursor: number) {
  return cursor;
}

export function firstMovementStopCursor(board: Tile[], fromCursor: number, toCursor: number) {
  if (!board.length || toCursor < fromCursor) return null;
  const epsilon = 0.0001;
  const firstBoundary = Math.ceil(fromCursor - epsilon);
  const lastBoundary = Math.floor(toCursor + epsilon);

  for (let cursor = firstBoundary; cursor <= lastBoundary; cursor += 1) {
    if (cursor + epsilon < fromCursor) continue;
    if (blocksContinuousMovement(board, cursor)) return cursor;
  }

  return null;
}

export function clampCursorAtMovementStop(board: Tile[], fromCursor: number, toCursor: number) {
  if (!board.length || toCursor <= fromCursor) return toCursor;
  const stopCursor = firstMovementStopCursor(board, Math.floor(fromCursor) + 1, toCursor);
  return stopCursor === null ? toCursor : visualMovementStopCursor(board, stopCursor);
}

export function reconcileVisualCursor(
  board: Tile[],
  previousCursor: number | null,
  targetCursor: number,
  localCursor: number
) {
  if (previousCursor === null) return targetCursor;
  if (!board.length) return targetCursor;

  const authorityDelta = targetCursor - previousCursor;
  if (Math.abs(authorityDelta) > board.length / 2 || authorityDelta < -hardVisualCorrectionCursor) {
    return targetCursor;
  }

  if (cursorHasMovementStop(board, targetCursor)) return targetCursor;

  const cursor = Math.max(targetCursor, localCursor);
  const maxCursor = clampCursorAtMovementStop(board, targetCursor, targetCursor + maxVisualAuthorityLeadCursor);
  return Math.min(cursor, maxCursor);
}

export function keepForwardVisualCursor(board: Tile[], previousCursor: number | null, targetCursor: number) {
  if (previousCursor === null || !board.length) return targetCursor;
  const authorityDelta = targetCursor - previousCursor;
  if (authorityDelta < 0 && Math.abs(authorityDelta) < board.length / 2) {
    const stopCursor = cursorHasMovementStop(board, targetCursor)
      ? visualMovementStopCursor(board, targetCursor)
      : clampCursorAtMovementStop(board, targetCursor, previousCursor);
    if (stopCursor < previousCursor) return stopCursor;
    return previousCursor;
  }
  return targetCursor;
}

function projectedCursorAfterSegment(board: Tile[], segment: NonNullable<Player['nextMovement']>, serverClock: number) {
  const durationMs = Math.max(1, segment.arriveAt - segment.departAt);
  if (serverClock <= segment.arriveAt) {
    return clampCursorAtMovementStop(board, segment.fromCursor, segmentCursor(segment, serverClock));
  }

  let cursor = segment.toCursor;
  let remainingMs = serverClock - segment.arriveAt;
  let guard = board.length + 1;

  while (remainingMs > 0 && guard > 0) {
    if (blocksContinuousMovement(board, cursor)) return visualMovementStopCursor(board, cursor);
    const stepProgress = Math.min(1, remainingMs / durationMs);
    cursor = clampCursorAtMovementStop(board, cursor, cursor + stepProgress);
    remainingMs -= durationMs * stepProgress;
    guard -= 1;
  }

  return cursor;
}

export function authoritativeCursor(player: Player) {
  const boardLength = Math.max(1, player.board.length);
  return player.laps * boardLength + player.position;
}

export function playerMotionIsLocked(player: Player, authorityPaused = false) {
  return authorityPaused || Boolean(player.combat || player.stunRemainingMs);
}

export function combatEngageIsPending(player: Player, serverNow: number, receivedAt?: number, authorityPaused = false) {
  if (!player.combat || authorityPaused) return false;
  return serverPresentationClock(serverNow, receivedAt) < player.combat.startedAt;
}

export function visualCursorForPlayer(player: Player, serverNow: number, receivedAt?: number, authorityPaused = false) {
  const baseCursor = authoritativeCursor(player);
  if (authorityPaused || player.stunRemainingMs) return baseCursor;

  const serverClock = serverPresentationClock(serverNow, receivedAt);
  if (player.combat) {
    const arrival = player.arrivalMovement;
    if (arrival && serverClock < player.combat.startedAt) {
      return segmentCursor(arrival, serverClock);
    }
    return baseCursor;
  }

  const arrival = player.arrivalMovement;
  if (arrival && serverClock < arrival.arriveAt) {
    return segmentCursor(arrival, serverClock);
  }

  const next = player.nextMovement;
  if (next && serverClock >= next.departAt) {
    return projectedCursorAfterSegment(player.board, next, serverClock);
  }

  return baseCursor;
}

export function visualFrameCursorForPlayer(
  player: Player,
  previousCursor: number | null,
  localStepCursor: number,
  serverNow: number,
  receivedAt?: number,
  authorityPaused = false
) {
  const rawTargetCursor = visualCursorForPlayer(player, serverNow, receivedAt, authorityPaused);
  if (playerMotionIsLocked(player, authorityPaused)) return rawTargetCursor;
  const targetCursor = keepForwardVisualCursor(player.board, previousCursor, rawTargetCursor);
  return reconcileVisualCursor(player.board, previousCursor, targetCursor, localStepCursor);
}

export function pendingCombatStopCursor(player: Player, serverNow: number, receivedAt?: number, authorityPaused = false) {
  if (player.combat || player.stunRemainingMs || authorityPaused) return null;
  const baseCursor = authoritativeCursor(player);
  const searchFromCursor = baseCursor + 0.001;
  const candidateCursors = [
    player.arrivalMovement?.toCursor,
    player.nextMovement?.toCursor,
    visualCursorForPlayer(player, serverNow, receivedAt, authorityPaused)
  ].filter((cursor): cursor is number => typeof cursor === 'number' && Number.isFinite(cursor));
  const lookaheadCursor = Math.max(searchFromCursor, ...candidateCursors);
  return firstMovementStopCursor(player.board, searchFromCursor, lookaheadCursor);
}

export function visualPointForPlayer(player: Player, serverNow: number, receivedAt?: number, authorityPaused = false) {
  return pointAlongBoard(player.board, visualCursorForPlayer(player, serverNow, receivedAt, authorityPaused));
}
