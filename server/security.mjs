// Trust-boundary helpers for the socket layer (see
// docs/production-readiness-audit.md, Tier 1). Pure functions so they can be
// unit-tested without standing up the server.
import crypto from 'node:crypto';

// Hard caps on client-supplied identifier strings. Anything longer is either a
// bug or an attack; real ids (UUIDs, card instance ids, offer ids) are short.
const MAX_ID_LENGTH = 64;

/**
 * Sanitize a client-supplied identifier: non-empty trimmed string up to
 * MAX_ID_LENGTH. Returns null when the value is unusable.
 */
export function cleanId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_ID_LENGTH) return null;
  return trimmed;
}

/**
 * Validate a client-supplied board index against the board it targets.
 * Returns the integer index, or null when out of bounds / not an integer.
 */
export function cleanTileIndex(value, board) {
  const index = Number(value);
  if (!Number.isInteger(index)) return null;
  if (!Array.isArray(board) || index < 0 || index >= board.length) return null;
  return index;
}

/**
 * Decide which identity a join request gets.
 *
 * The public player id (broadcast in room state, used for targeting) is NOT a
 * credential. Reconnection rights come from a server-issued secret, stored in
 * room.playerSecrets and sent only to the owning socket via the `session`
 * event. Policy:
 *
 * - Token matches a known secret → that seat's player id. The player object
 *   may be gone (rematch reset, server restart) — the binding persists so the
 *   seat, and with it host status, is reclaimed. A live socket on the seat is
 *   replaced (same-browser new tab); the secret IS ownership.
 * - Anything else (no token, unknown token) → fresh id + fresh secret. The
 *   public id of another player grants nothing.
 */
export function resolveJoinIdentity(room, playerToken) {
  if (!room.playerSecrets || typeof room.playerSecrets !== 'object') {
    room.playerSecrets = {};
  }
  const token = cleanId(playerToken);
  if (token) {
    const claimedId = Object.entries(room.playerSecrets)
      .find(([, secret]) => secret === token)?.[0];
    if (claimedId && !room.players[claimedId]?.isBot) {
      return { playerId: claimedId, secret: token, reconnect: true };
    }
  }
  return {
    playerId: crypto.randomUUID(),
    secret: crypto.randomUUID(),
    reconnect: false
  };
}
