import type { GameState, MovementSegment, Player } from './types';

const timelineGraceMs = 320;

function estimatedServerNow(state: GameState, localNow: number) {
  return state.now + (state.receivedAt ? localNow - state.receivedAt : 0);
}

function segmentIsActive(segment: MovementSegment | null | undefined, serverNow: number) {
  return Boolean(segment && segment.arriveAt + timelineGraceMs >= serverNow);
}

function playerTimelineIsActive(player: Player, serverNow: number) {
  if (segmentIsActive(player.nextMovement, serverNow)) return true;
  if (player.combat && player.combat.expiresAt + timelineGraceMs >= serverNow) return true;
  if (typeof player.stunnedUntil === 'number' && player.stunnedUntil + timelineGraceMs >= serverNow) return true;
  return false;
}

export function hasActiveAuthorityTimeline(state: GameState, localNow: number) {
  const serverNow = estimatedServerNow(state, localNow);
  return state.players.some((player) => playerTimelineIsActive(player, serverNow));
}

export function isAuthorityStateStale(state: GameState | null, localNow: number, staleMs: number) {
  if (!state?.receivedAt) return true;
  const ageMs = localNow - state.receivedAt;
  return ageMs > staleMs && !hasActiveAuthorityTimeline(state, localNow);
}
