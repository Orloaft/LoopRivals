import {
  absorbRoomClockDrift,
  drainRoomEvents,
  roomSnapshot,
  runRoomStep,
  score
} from './rules.mjs';

const defaultJournalLimit = 256;
const snapshotRequiredEventTypes = new Set([
  'cardDrawn',
  'cardPlayed',
  'cardSold',
  'heroAbilityActivated',
  'levelReached',
  'lootEquipped',
  'lootSold',
  'playerJoined',
  'playerTierChanged',
  'roomClockDriftAbsorbed',
  'roomReset',
  'roomSettingsChanged',
  'shopOfferBought',
  'stunQueued',
  'tierChanged',
  'traitChosen'
]);

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function roomEventServerTime(room) {
  return room?.simulated && Number.isFinite(room.now) ? room.now : Date.now();
}

function normalizeCommandId(commandId) {
  const id = String(commandId ?? '').trim();
  return id ? id.slice(0, 80) : null;
}

function normalizeCommandPlayerId(playerId) {
  return playerId === null || playerId === undefined ? null : String(playerId).slice(0, 80);
}

function commandResultForJournal(result) {
  if (result === undefined) return null;
  if (result === null || typeof result !== 'object' || Array.isArray(result)) return result;
  return Object.fromEntries(Object.entries(result).filter(([, value]) => (
    value === null || ['boolean', 'number', 'string'].includes(typeof value)
  )));
}

function commandEventSeqs(events) {
  return events
    .map((event) => Number(event?.seq))
    .filter(Number.isFinite);
}

function commandRejectionReason(result) {
  if (result?.full) return 'room-full';
  if (result === false || result === null) return 'mutator-rejected';
  return 'no-op';
}

function movementKey(value) {
  return value ? JSON.stringify(value) : null;
}

function combatKey(value) {
  if (!value) return null;
  return [
    value.label,
    value.enemyId,
    value.startedAt,
    value.expiresAt,
    value.heroHpAfter,
    value.enemyHpAfter
  ].join(':');
}

function roomFacts(room) {
  const players = new Map();
  for (const [playerId, player] of Object.entries(room.players)) {
    players.set(playerId, {
      id: playerId,
      name: player.name,
      position: player.position,
      laps: player.laps,
      level: player.level,
      hp: player.hp,
      deaths: player.deaths,
      score: score(player),
      event: player.event,
      message: player.message,
      nextMovement: movementKey(player.nextMovement),
      arrivalMovement: movementKey(player.arrivalMovement),
      combat: combatKey(player.combat),
      lootIds: player.loot.map((item) => item.id),
      tileTypes: player.board.map((tile) => `${tile.index}:${tile.type}:${tile.charges}:${tile.expiresOnLap ?? ''}`)
    });
  }

  return {
    status: room.status,
    tick: room.tick,
    tierId: room.tier?.id ?? null,
    winnerId: room.winnerId ?? null,
    players
  };
}

function compactJournal(journal, limit) {
  if (journal.length > limit) journal.splice(0, journal.length - limit);
}

function roomFactsKey(facts) {
  return JSON.stringify({
    status: facts.status,
    tick: facts.tick,
    tierId: facts.tierId,
    winnerId: facts.winnerId,
    players: [...facts.players.values()]
  });
}

export function eventRequiresSnapshot(event) {
  return snapshotRequiredEventTypes.has(event?.type);
}

export function eventsRequireSnapshot(events) {
  return Array.isArray(events) && events.some((event) => eventRequiresSnapshot(event));
}

export function roomEventBroadcastPolicy(events) {
  const eventList = Array.isArray(events) ? events : [];
  const delta = eventList.length > 0;
  const snapshotRequired = eventsRequireSnapshot(eventList);
  const eventSeqs = commandEventSeqs(eventList);
  return {
    delta,
    snapshot: delta && snapshotRequired,
    snapshotRequired,
    eventSeqs,
    firstSeq: eventSeqs[0] ?? null,
    lastSeq: eventSeqs.at(-1) ?? null
  };
}

export class RoomRuntime {
  constructor(room, options = {}) {
    this.room = room;
    this.snapshotSeq = Number.isFinite(options.snapshotSeq) ? options.snapshotSeq : 0;
    this.eventSeq = Number.isFinite(options.eventSeq) ? options.eventSeq : 0;
    this.commandSeq = Number.isFinite(options.commandSeq) ? options.commandSeq : 0;
    this.journalLimit = Number.isFinite(options.journalLimit) ? options.journalLimit : defaultJournalLimit;
    this.events = Array.isArray(options.events) ? options.events.slice(-this.journalLimit) : [];
    this.commands = Array.isArray(options.commands) ? options.commands.slice(-this.journalLimit) : [];
  }

  serialize() {
    return {
      version: 1,
      snapshotSeq: this.snapshotSeq,
      eventSeq: this.eventSeq,
      commandSeq: this.commandSeq,
      journalLimit: this.journalLimit,
      events: cloneJson(this.events),
      commands: cloneJson(this.commands)
    };
  }

  eventsSince(seq) {
    const fromSeq = Number(seq);
    if (!Number.isFinite(fromSeq) || fromSeq < 0) return null;
    const firstSeq = this.events[0]?.seq ?? this.eventSeq + 1;
    if (fromSeq < firstSeq - 1) return null;
    return this.events.filter((event) => event.seq > fromSeq);
  }

  snapshot(reason = 'recovery') {
    this.snapshotSeq += 1;
    return {
      ...roomSnapshot(this.room),
      runtime: {
        protocol: 1,
        reason,
        snapshotSeq: this.snapshotSeq,
        eventSeq: this.eventSeq,
        journalBaseSeq: this.events[0]?.seq ?? this.eventSeq + 1,
        generatedAt: Date.now()
      }
    };
  }

  appendEvent(type, payload = {}) {
    this.eventSeq += 1;
    const event = {
      seq: this.eventSeq,
      type,
      roomId: this.room.id,
      tick: this.room.tick,
      serverTime: roomEventServerTime(this.room),
      payload
    };
    this.events.push(event);
    compactJournal(this.events, this.journalLimit);
    return event;
  }

  appendRuleEvents(ruleEvents, context = {}) {
    return ruleEvents.map((event) => this.appendEvent(event.type, {
      cause: context.cause ?? 'unknown',
      actorId: context.actorId ?? null,
      ...(event.payload ?? {})
    }));
  }

  findCommand(name, { playerId = null, commandId = null } = {}) {
    const normalizedCommandId = normalizeCommandId(commandId);
    if (!normalizedCommandId) return null;
    const normalizedPlayerId = normalizeCommandPlayerId(playerId);
    return this.commands.findLast((command) => (
      command?.roomId === this.room.id &&
      command?.name === name &&
      command?.commandId === normalizedCommandId &&
      (command?.playerId ?? null) === normalizedPlayerId
    )) ?? null;
  }

  recordCommand(name, { playerId = null, commandId = null, payload = {} } = {}) {
    this.commandSeq += 1;
    const command = {
      seq: this.commandSeq,
      commandId: normalizeCommandId(commandId),
      name,
      roomId: this.room.id,
      playerId: normalizeCommandPlayerId(playerId),
      receivedAt: Date.now(),
      tick: this.room.tick,
      payload: cloneJson(payload),
      accepted: null,
      reason: null,
      result: null,
      eventSeqs: [],
      firstEventSeq: null,
      lastEventSeq: null,
      snapshotRequired: false
    };
    this.commands.push(command);
    compactJournal(this.commands, this.journalLimit);
    return command;
  }

  finalizeCommand(command, { result, accepted, reason, events }) {
    const eventSeqs = commandEventSeqs(events);
    command.accepted = Boolean(accepted);
    command.reason = reason ?? null;
    command.result = commandResultForJournal(result);
    command.eventSeqs = eventSeqs;
    command.firstEventSeq = eventSeqs[0] ?? null;
    command.lastEventSeq = eventSeqs.at(-1) ?? null;
    command.snapshotRequired = eventsRequireSnapshot(events);
    return command;
  }

  commandOutcome(command, events, { duplicate = false } = {}) {
    const eventSeqs = Array.isArray(command?.eventSeqs) ? command.eventSeqs.slice() : commandEventSeqs(events);
    return {
      result: command?.result ?? null,
      command,
      events,
      accepted: Boolean(command?.accepted),
      duplicate,
      reason: command?.reason ?? (command?.accepted ? null : 'unknown'),
      eventSeqs,
      firstSeq: command?.firstEventSeq ?? eventSeqs[0] ?? null,
      lastSeq: command?.lastEventSeq ?? eventSeqs.at(-1) ?? null,
      snapshotRequired: Boolean(command?.snapshotRequired)
    };
  }

  commitCommand(name, context, mutator) {
    const duplicateCommand = this.findCommand(name, context);
    if (duplicateCommand) return this.commandOutcome(duplicateCommand, [], { duplicate: true });

    const before = roomFacts(this.room);
    drainRoomEvents(this.room);
    const command = this.recordCommand(name, context);
    const result = mutator();
    const ruleEvents = drainRoomEvents(this.room);
    const after = roomFacts(this.room);
    const changed = roomFactsKey(before) !== roomFactsKey(after);
    const accepted = result !== false && result !== null && !result?.full && (changed || ruleEvents.length > 0 || result === true);
    const reason = accepted ? null : commandRejectionReason(result);
    const events = [this.appendEvent(accepted ? 'commandAccepted' : 'commandRejected', {
      commandSeq: command.seq,
      commandId: command.commandId,
      name,
      playerId: command.playerId,
      reason
    })];
    if (accepted && ruleEvents.length > 0) {
      events.push(...this.appendRuleEvents(ruleEvents, { cause: name, actorId: command.playerId }));
    } else if (accepted) {
      events.push(...this.eventsFromDiff(before, after, { cause: name, actorId: command.playerId, diagnostic: true }));
    }
    this.finalizeCommand(command, { result, accepted, reason, events });
    return this.commandOutcome(command, events);
  }

  step(elapsedMs, simulationIntervalMs) {
    drainRoomEvents(this.room);
    absorbRoomClockDrift(this.room, elapsedMs, simulationIntervalMs);
    const before = roomFacts(this.room);
    runRoomStep(this.room);
    const after = roomFacts(this.room);
    const ruleEvents = drainRoomEvents(this.room);
    const events = ruleEvents.length > 0
      ? this.appendRuleEvents(ruleEvents, { cause: 'simulation' })
      : this.eventsFromDiff(before, after, { cause: 'simulation', diagnostic: true });
    return events;
  }

  eventsFromDiff(before, after, context = {}) {
    const events = [];
    const base = {
      cause: context.cause ?? 'unknown',
      actorId: context.actorId ?? null,
      diagnostic: Boolean(context.diagnostic)
    };

    if (before.status !== after.status) {
      events.push(this.appendEvent('roomStatusChanged', { ...base, from: before.status, to: after.status }));
    }
    if (before.tierId !== after.tierId) {
      events.push(this.appendEvent('tierChanged', { ...base, from: before.tierId, to: after.tierId }));
    }
    if (before.winnerId !== after.winnerId && after.winnerId) {
      events.push(this.appendEvent('matchFinished', { ...base, winnerId: after.winnerId }));
    }

    for (const [playerId, current] of after.players.entries()) {
      const previous = before.players.get(playerId);
      if (!previous) {
        events.push(this.appendEvent('playerJoined', { ...base, playerId, name: current.name }));
        continue;
      }

      if (previous.nextMovement !== current.nextMovement || previous.arrivalMovement !== current.arrivalMovement) {
        const player = this.room.players[playerId];
        events.push(this.appendEvent('movementSegment', {
          ...base,
          playerId,
          nextMovement: player?.combat ? null : player?.nextMovement ?? null,
          arrivalMovement: player?.arrivalMovement ?? null
        }));
      }
      if (previous.combat !== current.combat) {
        events.push(this.appendEvent(current.combat ? 'combatStarted' : 'combatEnded', {
          ...base,
          playerId,
          tileIndex: current.position,
          position: current.position,
          laps: current.laps,
          tileType: this.room.players[playerId]?.board[current.position]?.type ?? null,
          combat: this.room.players[playerId]?.combat ?? null
        }));
      }
      if (current.laps > previous.laps) {
        events.push(this.appendEvent('lapCompleted', { ...base, playerId, from: previous.laps, to: current.laps }));
      }
      if (current.deaths > previous.deaths) {
        events.push(this.appendEvent('playerDefeated', { ...base, playerId, from: previous.deaths, to: current.deaths }));
      }
      if (current.lootIds.length > previous.lootIds.length) {
        events.push(this.appendEvent('lootGranted', {
          ...base,
          playerId,
          itemIds: current.lootIds.filter((itemId) => !previous.lootIds.includes(itemId))
        }));
      }
      if (previous.position !== current.position || previous.event !== current.event || previous.message !== current.message) {
        events.push(this.appendEvent('tileResolved', {
          ...base,
          playerId,
          from: previous.position,
          to: current.position,
          tileIndex: current.position,
          position: current.position,
          laps: current.laps,
          hp: current.hp,
          score: current.score,
          level: current.level,
          deaths: current.deaths,
          tileType: this.room.players[playerId]?.board[current.position]?.type ?? null,
          event: current.event,
          message: current.message
        }));
      }
      if (previous.tileTypes.join('|') !== current.tileTypes.join('|')) {
        events.push(this.appendEvent('boardChanged', {
          ...base,
          playerId,
          board: cloneJson(this.room.players[playerId]?.board ?? [])
        }));
      }
      if (previous.score !== current.score || previous.hp !== current.hp || previous.level !== current.level) {
        events.push(this.appendEvent('playerProjectionChanged', {
          ...base,
          playerId,
          score: current.score,
          hp: current.hp,
          level: current.level
        }));
      }
    }

    for (const playerId of before.players.keys()) {
      if (!after.players.has(playerId)) events.push(this.appendEvent('playerRemoved', { ...base, playerId }));
    }

    return events;
  }
}

export function createRoomRuntime(room, snapshot = null) {
  return new RoomRuntime(room, snapshot && typeof snapshot === 'object' ? snapshot : {});
}
