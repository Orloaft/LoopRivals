import type { RoomDelta, RoomEvent } from './types';

export type ClientCommandStatus = 'accepted' | 'rejected' | 'failed' | 'timeout';

export type ClientCommandResult = {
  commandId: string;
  status: ClientCommandStatus;
  name?: string;
  playerId?: string;
  reason?: string | null;
  message?: string | null;
  retryable?: boolean;
};

export type ClientCommandTransport = {
  send: (eventName: string, payload?: unknown, options?: SendClientCommandOptions) => string | null;
  observeRoomDelta: (delta: RoomDelta) => void;
  observeCommandResult: (result: ClientCommandResult) => void;
  pendingCount: () => number;
  dispose: () => void;
};

export type SendClientCommandOptions = {
  generateCommandId?: boolean;
  trackAck?: boolean;
  retry?: boolean;
};

type PendingCommand = {
  commandId: string;
  eventName: string;
  payload: Record<string, unknown>;
  retryable: boolean;
  retries: number;
  attempts: number;
  timeoutHandle: unknown;
  exhausted: boolean;
};

type TimerApi = {
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

type CreateClientCommandTransportOptions = {
  emit: (eventName: string, payload: Record<string, unknown>, ack?: (payload: unknown) => void) => void;
  onNotice?: (message: string) => void;
  onCommandResult?: (result: ClientCommandResult) => void;
  shouldRetry?: () => boolean;
  getPlayerId?: () => string | null;
  makeCommandId?: (eventName: string) => string;
  ackTimeoutMs?: number;
  maxRetries?: number;
  timers?: TimerApi;
};

const defaultAckTimeoutMs = 900;
const defaultMaxRetries = 2;
const completedCommandLimit = 128;
let commandSeq = 0;

function defaultTimers(): TimerApi {
  return {
    setTimeout: (callback, ms) => window.setTimeout(callback, ms),
    clearTimeout: (handle) => {
      if (typeof handle === 'number') window.clearTimeout(handle);
    }
  };
}

function fallbackTimers(): TimerApi {
  return {
    setTimeout: (callback, ms) => setTimeout(callback, ms),
    clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)
  };
}

function timersForRuntime() {
  return typeof window === 'undefined' ? fallbackTimers() : defaultTimers();
}

export function makeClientCommandId(eventName: string, now = Date.now, random = Math.random) {
  commandSeq += 1;
  const safeEventName = eventName.replace(/[^a-z0-9:_-]/gi, '').slice(0, 32) || 'command';
  const entropy = Math.floor(random() * 0xfffff).toString(36).padStart(4, '0');
  return `client-${safeEventName}-${now().toString(36)}-${commandSeq.toString(36)}-${entropy}`;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function payloadObject(payload: unknown): Record<string, unknown> {
  return { ...(objectValue(payload) ?? {}) };
}

function normalizedStatus(value: unknown): string | null {
  return stringValue(value)?.toLowerCase() ?? null;
}

function trimReason(value: unknown) {
  return stringValue(value)?.slice(0, 160) ?? null;
}

export function commandResultFromAckPayload(payload: unknown, fallbackCommandId: string): ClientCommandResult | null {
  const ack = objectValue(payload);
  if (!ack) return null;

  const commandId = stringValue(ack.commandId) ?? fallbackCommandId;
  if (!commandId) return null;

  const status = normalizedStatus(ack.status);
  const ok = booleanValue(ack.ok);
  const accepted = booleanValue(ack.accepted);
  const retryable = booleanValue(ack.retryable) ?? undefined;
  const reason = trimReason(ack.reason ?? ack.error);
  const message = trimReason(ack.message);
  const name = stringValue(ack.name) ?? undefined;
  const playerId = stringValue(ack.playerId) ?? undefined;

  if (status === 'accepted' || status === 'ok' || status === 'success' || ok === true || accepted === true) {
    return { commandId, status: 'accepted', name, playerId, reason, message, retryable };
  }

  if (status === 'rejected' || status === 'denied' || accepted === false) {
    return { commandId, status: 'rejected', name, playerId, reason, message, retryable };
  }

  if (status === 'failed' || status === 'error' || status === 'timeout' || ok === false) {
    return { commandId, status: 'failed', name, playerId, reason, message, retryable };
  }

  return null;
}

function commandResultFromRoomEvent(event: RoomEvent): ClientCommandResult | null {
  if (event.type !== 'commandAccepted' && event.type !== 'commandRejected') return null;
  const payload = objectValue(event.payload) ?? {};
  const commandId = stringValue(payload.commandId);
  if (!commandId) return null;
  return {
    commandId,
    status: event.type === 'commandAccepted' ? 'accepted' : 'rejected',
    name: stringValue(payload.name) ?? undefined,
    playerId: stringValue(payload.playerId) ?? undefined,
    reason: trimReason(payload.reason),
    message: trimReason(payload.message)
  };
}

export function commandResultsFromRoomDelta(delta: RoomDelta): ClientCommandResult[] {
  return delta.events
    .map(commandResultFromRoomEvent)
    .filter((result): result is ClientCommandResult => Boolean(result));
}

function commandLabel(eventName?: string) {
  if (!eventName) return 'Action';
  const words = eventName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[:_-]+/g, ' ')
    .trim();
  if (!words) return 'Action';
  const normalized = words.toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function rejectionNotice(result: ClientCommandResult, eventName?: string) {
  const label = commandLabel(result.name ?? eventName);
  const reason = result.message ?? result.reason;
  return reason && reason !== 'no-op'
    ? `${label} rejected: ${reason}.`
    : `${label} rejected by the server.`;
}

function timeoutNotice(eventName: string) {
  return `${commandLabel(eventName)} is waiting for server confirmation.`;
}

export function createClientCommandTransport(options: CreateClientCommandTransportOptions): ClientCommandTransport {
  const ackTimeoutMs = options.ackTimeoutMs ?? defaultAckTimeoutMs;
  const maxRetries = options.maxRetries ?? defaultMaxRetries;
  const timers = options.timers ?? timersForRuntime();
  const shouldRetry = options.shouldRetry ?? (() => true);
  const makeCommandId = options.makeCommandId ?? makeClientCommandId;
  const pending = new Map<string, PendingCommand>();
  const completed = new Set<string>();
  const completedOrder: string[] = [];

  const markCompleted = (commandId: string) => {
    if (completed.has(commandId)) return;
    completed.add(commandId);
    completedOrder.push(commandId);
    while (completedOrder.length > completedCommandLimit) {
      const expired = completedOrder.shift();
      if (expired) completed.delete(expired);
    }
  };

  const clearTimer = (command: PendingCommand) => {
    if (command.timeoutHandle === null) return;
    timers.clearTimeout(command.timeoutHandle);
    command.timeoutHandle = null;
  };

  const armTimer = (command: PendingCommand) => {
    clearTimer(command);
    command.timeoutHandle = timers.setTimeout(() => handleTimeout(command.commandId), ackTimeoutMs);
  };

  const emitAttempt = (command: PendingCommand) => {
    command.attempts += 1;
    command.exhausted = false;
    options.emit(command.eventName, command.payload, (payload) => {
      const result = commandResultFromAckPayload(payload, command.commandId);
      if (result) handleResult(result);
    });
    armTimer(command);
  };

  const retryOrWait = (command: PendingCommand, result: ClientCommandResult) => {
    clearTimer(command);
    if (!command.retryable || result.retryable === false) {
      command.exhausted = true;
      return;
    }

    if (!shouldRetry()) {
      armTimer(command);
      return;
    }

    if (command.retries >= maxRetries) {
      command.exhausted = true;
      options.onNotice?.(timeoutNotice(command.eventName));
      options.onCommandResult?.({ ...result, status: 'timeout' });
      return;
    }

    command.retries += 1;
    emitAttempt(command);
  };

  function handleTimeout(commandId: string) {
    const command = pending.get(commandId);
    if (!command || completed.has(commandId)) return;
    retryOrWait(command, {
      commandId,
      status: 'timeout',
      retryable: true
    });
  }

  const handleResult = (result: ClientCommandResult) => {
    if (completed.has(result.commandId)) return;
    options.onCommandResult?.(result);
    const command = pending.get(result.commandId);

    if (result.status === 'accepted') {
      if (command) clearTimer(command);
      pending.delete(result.commandId);
      markCompleted(result.commandId);
      return;
    }

    if (result.status === 'rejected') {
      if (command) {
        clearTimer(command);
        pending.delete(result.commandId);
        options.onNotice?.(rejectionNotice(result, command.eventName));
      } else if (result.playerId && result.playerId === options.getPlayerId?.()) {
        options.onNotice?.(rejectionNotice(result));
      }
      markCompleted(result.commandId);
      return;
    }

    if (command) retryOrWait(command, result);
  };

  return {
    send(eventName, payload, sendOptions = {}) {
      const generated = sendOptions.generateCommandId !== false;
      const commandPayload = payloadObject(payload);
      const commandId = generated ? makeCommandId(eventName) : stringValue(commandPayload.commandId);
      if (commandId) commandPayload.commandId = commandId;

      const shouldTrack = Boolean(commandId && generated && sendOptions.trackAck !== false);
      const retryable = sendOptions.retry !== false;
      if (!shouldTrack || !commandId) {
        options.emit(eventName, commandPayload);
        return commandId;
      }

      const command: PendingCommand = {
        commandId,
        eventName,
        payload: commandPayload,
        retryable,
        retries: 0,
        attempts: 0,
        timeoutHandle: null,
        exhausted: false
      };
      pending.set(commandId, command);
      emitAttempt(command);
      return commandId;
    },

    observeRoomDelta(delta) {
      for (const result of commandResultsFromRoomDelta(delta)) {
        handleResult(result);
      }
    },

    observeCommandResult(result) {
      handleResult(result);
    },

    pendingCount() {
      return pending.size;
    },

    dispose() {
      for (const command of pending.values()) clearTimer(command);
      pending.clear();
      completed.clear();
      completedOrder.length = 0;
    }
  };
}
