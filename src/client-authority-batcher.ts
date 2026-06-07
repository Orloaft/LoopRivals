import type { GameState, RoomDelta } from './types';

export type QueuedRoomAuthorityMessage =
  | { type: 'state'; payload: GameState }
  | { type: 'delta'; payload: RoomDelta };

export type RoomRecoveryRequest = {
  roomId: string;
  fromSeq: number;
  targetSeq: number;
};

export type RoomAuthorityBatchResult = {
  state: GameState | null;
  committed: boolean;
  acceptedSeq: number;
  recovery: RoomRecoveryRequest | null;
  messageCount: number;
};

export type RoomAuthorityBatcher = {
  enqueueState: (payload: GameState) => void;
  enqueueDelta: (payload: RoomDelta) => void;
  flush: () => void;
  dispose: () => void;
};

type Scheduler = (callback: () => void) => unknown;
type CancelScheduler = (handle: unknown) => void;

type CreateRoomAuthorityBatcherOptions = {
  getState: () => GameState | null;
  commitState: (state: GameState) => void;
  applyDelta: ApplyRoomDelta;
  onAcceptedSeq?: (seq: number) => void;
  onRecovery?: (request: RoomRecoveryRequest) => void;
  now?: () => number;
  schedule?: Scheduler;
  cancelSchedule?: CancelScheduler;
};

export type ApplyRoomDelta = (state: GameState, delta: RoomDelta, receivedAt?: number) => {
  state: GameState;
  appliedEvents: number;
  acceptedSeq: number;
  needsRecovery: boolean;
};

function stateEventSeq(state: GameState | null) {
  return state?.runtime?.eventSeq ?? 0;
}

function deltaStartSeq(delta: RoomDelta) {
  return delta.events[0]?.seq ?? delta.firstSeq ?? delta.lastSeq;
}

function compareRoomDeltas(a: RoomDelta, b: RoomDelta) {
  const startDiff = deltaStartSeq(a) - deltaStartSeq(b);
  if (startDiff !== 0) return startDiff;
  return a.lastSeq - b.lastSeq;
}

function withReceivedAt(state: GameState, receivedAt: number): GameState {
  return { ...state, receivedAt };
}

function defaultSchedule(callback: () => void) {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback);
  }
  queueMicrotask(callback);
  return null;
}

function defaultCancelSchedule(handle: unknown) {
  if (typeof handle === 'number' && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(handle);
  }
}

export function applyQueuedRoomAuthorityMessages(
  currentState: GameState | null,
  messages: QueuedRoomAuthorityMessage[],
  applyDelta: ApplyRoomDelta,
  receivedAt = Date.now()
): RoomAuthorityBatchResult {
  let nextState = currentState;
  let committed = false;
  let acceptedSeq = stateEventSeq(currentState);
  let recovery: RoomRecoveryRequest | null = null;
  let pendingDeltas: RoomDelta[] = [];

  const clearCoveredRecovery = () => {
    if (!recovery) return;
    if (stateEventSeq(nextState) >= recovery.targetSeq) recovery = null;
  };

  const drainDeltas = () => {
    if (pendingDeltas.length === 0) return;
    if (!nextState) {
      pendingDeltas = [];
      return;
    }

    const orderedDeltas = pendingDeltas.slice().sort(compareRoomDeltas);
    pendingDeltas = [];

    for (const delta of orderedDeltas) {
      const projection = applyDelta(nextState, delta, receivedAt);
      acceptedSeq = Math.max(acceptedSeq, projection.acceptedSeq);
      if (projection.state !== nextState) committed = true;
      nextState = projection.state;

      if (projection.needsRecovery) {
        recovery = {
          roomId: nextState.id,
          fromSeq: projection.acceptedSeq,
          targetSeq: delta.lastSeq
        };
        break;
      }
    }
  };

  for (const message of messages) {
    if (message.type === 'delta') {
      pendingDeltas.push(message.payload);
      continue;
    }

    drainDeltas();
    const incomingSeq = stateEventSeq(message.payload);
    if (incomingSeq < stateEventSeq(nextState) || incomingSeq < acceptedSeq) {
      clearCoveredRecovery();
      continue;
    }
    nextState = withReceivedAt(message.payload, receivedAt);
    committed = true;
    acceptedSeq = Math.max(acceptedSeq, stateEventSeq(nextState));
    clearCoveredRecovery();
  }

  drainDeltas();
  clearCoveredRecovery();

  return {
    state: nextState,
    committed,
    acceptedSeq,
    recovery,
    messageCount: messages.length
  };
}

export function createRoomAuthorityBatcher(options: CreateRoomAuthorityBatcherOptions): RoomAuthorityBatcher {
  const now = options.now ?? Date.now;
  const schedule = options.schedule ?? defaultSchedule;
  const cancelSchedule = options.cancelSchedule ?? defaultCancelSchedule;
  let queue: QueuedRoomAuthorityMessage[] = [];
  let scheduled = false;
  let scheduleHandle: unknown = null;

  const flush = () => {
    if (queue.length === 0) {
      scheduled = false;
      scheduleHandle = null;
      return;
    }

    const messages = queue;
    queue = [];
    scheduled = false;
    scheduleHandle = null;

    const result = applyQueuedRoomAuthorityMessages(options.getState(), messages, options.applyDelta, now());
    options.onAcceptedSeq?.(result.acceptedSeq);
    if (result.committed && result.state) options.commitState(result.state);
    if (result.recovery) options.onRecovery?.(result.recovery);
  };

  const ensureScheduled = () => {
    if (scheduled) return;
    scheduled = true;
    scheduleHandle = schedule(flush);
  };

  return {
    enqueueState(payload) {
      queue.push({ type: 'state', payload });
      ensureScheduled();
    },
    enqueueDelta(payload) {
      queue.push({ type: 'delta', payload });
      ensureScheduled();
    },
    flush,
    dispose() {
      queue = [];
      if (scheduled) cancelSchedule(scheduleHandle);
      scheduled = false;
      scheduleHandle = null;
    }
  };
}
