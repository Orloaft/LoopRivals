import type { Card, Player, RoomDelta, RoomEvent, Tile } from './types';

export type PendingTerrainPlacement = {
  commandId: string;
  playerId: string;
  cardInstanceId: string;
  tileIndex: number;
  tile: Tile;
  createdAt: number;
};

export const optimisticTerrainPlacementTimeoutMs = 2500;

const combatBlockingTileTypes = new Set([
  'grove',
  'bloomgrove',
  'crypt',
  'wolfden',
  'bonepit',
  'ruinedkeep',
  'ransackedvillage',
  'bloodmoon',
  'wyrmgate',
  'embergate',
  'spidernest',
  'tollgate',
  'thornmaze',
  'graveyard',
  'dragonroost',
  'rootwall',
  'bramblebloom',
  'wardensheart',
  'oldgrowth',
  'guardstance',
  'markedchallenge',
  'retaliation',
  'executionstance',
  'seal1',
  'seal2',
  'seal3',
  'innergate',
  'ambush'
]);

function tileLoopLife(player: Player) {
  return player.loopTier === 1 ? 3 : 2;
}

function movementStopForTileType(tileType: string) {
  return combatBlockingTileTypes.has(tileType)
    ? { movementStopKind: 'combat' as const, movementStopReason: 'combat' }
    : { movementStopKind: 'none' as const, movementStopReason: null };
}

export function createPendingTerrainPlacement(
  player: Player,
  card: Card,
  targetTile: Tile,
  commandId: string,
  createdAt: number
): PendingTerrainPlacement | null {
  if (card.kind !== 'terrain' || !card.tile || targetTile.type !== 'road') return null;
  return {
    commandId,
    playerId: player.id,
    cardInstanceId: card.instanceId,
    tileIndex: targetTile.index,
    createdAt,
    tile: {
      ...targetTile,
      type: card.tile,
      charges: card.tile === 'mire' ? 5 : 0,
      expiresOnLap: player.laps + tileLoopLife(player),
      ...movementStopForTileType(card.tile)
    }
  };
}

export function applyPendingTerrainPlacement(player: Player, pending: PendingTerrainPlacement | null, now: number) {
  if (!pending || pending.playerId !== player.id) return player;
  if (isPendingTerrainPlacementExpired(pending, now)) return player;
  const targetTile = player.board.find((tile) => tile.index === pending.tileIndex);
  if (!targetTile || targetTile.type !== 'road') return player;
  return {
    ...player,
    board: player.board.map((tile) => tile.index === pending.tileIndex ? pending.tile : tile)
  };
}

export function isPendingTerrainPlacementExpired(pending: PendingTerrainPlacement, now: number) {
  return now - pending.createdAt >= optimisticTerrainPlacementTimeoutMs;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function roomEventClearsPendingTerrainPlacement(pending: PendingTerrainPlacement, event: RoomEvent) {
  const payload = objectValue(event.payload) ?? {};
  const commandId = stringValue(payload.commandId);
  if (commandId === pending.commandId && event.type === 'commandRejected') return true;

  if (event.type === 'tileChanged') {
    const playerId = stringValue(payload.playerId);
    const tileIndex = numberValue(payload.tileIndex);
    return playerId === pending.playerId && tileIndex === pending.tileIndex;
  }

  return false;
}

export function roomDeltaClearsPendingTerrainPlacement(pending: PendingTerrainPlacement, delta: RoomDelta) {
  return delta.events.some((event) => roomEventClearsPendingTerrainPlacement(pending, event));
}
