export type SmoothnessPercentiles = {
  samples: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
};

export type SocketMetricDirection = 'inbound' | 'outbound';

export type SocketEventMetric = {
  eventName: string;
  direction: SocketMetricDirection;
  count: number;
  bytes: number;
  payloadBytes: SmoothnessPercentiles;
};

export type SmoothnessSnapshot = {
  rafFrameGapMs: SmoothnessPercentiles;
  longTasks: {
    supported: boolean;
    active: boolean;
    count: number;
    totalMs: number;
    durationMs: SmoothnessPercentiles;
  };
  socket: {
    count: number;
    bytes: number;
    inbound: { count: number; bytes: number };
    outbound: { count: number; bytes: number };
    events: SocketEventMetric[];
  };
  deltaApplyMs: SmoothnessPercentiles;
};

export type SmoothnessDebugApi = {
  snapshot: () => SmoothnessSnapshot;
  reset: () => void;
  log: () => SmoothnessSnapshot;
};

declare global {
  interface Window {
    __loopduelSmoothness?: SmoothnessDebugApi;
  }
}

const defaultSampleLimit = 900;

function nowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function roundMetric(value: number) {
  return Number(value.toFixed(2));
}

export function summarizeSamples(values: readonly number[]): SmoothnessPercentiles {
  if (values.length === 0) {
    return { samples: 0, avg: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const valueAt = (percentile: number) => {
    const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * percentile) - 1));
    return roundMetric(sorted[index]);
  };
  const total = sorted.reduce((sum, value) => sum + value, 0);

  return {
    samples: sorted.length,
    avg: roundMetric(total / sorted.length),
    p50: valueAt(0.5),
    p95: valueAt(0.95),
    p99: valueAt(0.99),
    max: roundMetric(sorted[sorted.length - 1])
  };
}

function trimSamples(values: number[], sampleLimit: number) {
  if (values.length > sampleLimit) values.splice(0, values.length - sampleLimit);
}

export function createDurationMetrics(sampleLimit = defaultSampleLimit) {
  const samples: number[] = [];

  return {
    record(durationMs: number) {
      if (!Number.isFinite(durationMs) || durationMs < 0) return;
      samples.push(durationMs);
      trimSamples(samples, sampleLimit);
    },
    measure<T>(callback: () => T) {
      const startedAt = nowMs();
      try {
        return callback();
      } finally {
        this.record(nowMs() - startedAt);
      }
    },
    snapshot() {
      return summarizeSamples(samples);
    },
    reset() {
      samples.length = 0;
    }
  };
}

export function createFrameGapMetrics(sampleLimit = defaultSampleLimit) {
  const gaps = createDurationMetrics(sampleLimit);
  let previousFrameAt: number | null = null;

  return {
    recordFrame(frameAt: number) {
      if (previousFrameAt !== null) gaps.record(frameAt - previousFrameAt);
      previousFrameAt = frameAt;
    },
    recordGap(gapMs: number) {
      gaps.record(gapMs);
    },
    resetClock() {
      previousFrameAt = null;
    },
    snapshot() {
      return gaps.snapshot();
    },
    reset() {
      previousFrameAt = null;
      gaps.reset();
    }
  };
}

function longTaskSupported() {
  if (typeof PerformanceObserver === 'undefined') return false;
  const observer = PerformanceObserver as typeof PerformanceObserver & { supportedEntryTypes?: readonly string[] };
  return Array.isArray(observer.supportedEntryTypes) && observer.supportedEntryTypes.includes('longtask');
}

export function createLongTaskMetrics(sampleLimit = 180) {
  const durations = createDurationMetrics(sampleLimit);
  let observer: PerformanceObserver | null = null;
  let count = 0;
  let totalMs = 0;

  const metrics = {
    start() {
      if (observer || !longTaskSupported()) return false;
      try {
        observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            count += 1;
            totalMs += entry.duration;
            durations.record(entry.duration);
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
        return true;
      } catch {
        observer = null;
        return false;
      }
    },
    stop() {
      observer?.disconnect();
      observer = null;
    },
    snapshot() {
      return {
        supported: longTaskSupported(),
        active: Boolean(observer),
        count,
        totalMs: roundMetric(totalMs),
        durationMs: durations.snapshot()
      };
    },
    reset() {
      count = 0;
      totalMs = 0;
      durations.reset();
    }
  };

  return metrics;
}

function estimatePayloadBytes(payload: unknown) {
  try {
    const json = JSON.stringify(payload);
    if (!json) return 0;
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(json).byteLength;
    return json.length;
  } catch {
    return 0;
  }
}

export function createSocketMetrics(sampleLimit = defaultSampleLimit) {
  const byEvent = new Map<string, {
    eventName: string;
    direction: SocketMetricDirection;
    count: number;
    bytes: number;
    payloadBytes: ReturnType<typeof createDurationMetrics>;
  }>();
  const totals = {
    count: 0,
    bytes: 0,
    inbound: { count: 0, bytes: 0 },
    outbound: { count: 0, bytes: 0 }
  };

  return {
    record(eventName: string, payload: unknown, direction: SocketMetricDirection = 'inbound') {
      const bytes = estimatePayloadBytes(payload);
      const key = `${direction}:${eventName}`;
      const metric = byEvent.get(key) ?? {
        eventName,
        direction,
        count: 0,
        bytes: 0,
        payloadBytes: createDurationMetrics(sampleLimit)
      };
      metric.count += 1;
      metric.bytes += bytes;
      metric.payloadBytes.record(bytes);
      byEvent.set(key, metric);

      totals.count += 1;
      totals.bytes += bytes;
      totals[direction].count += 1;
      totals[direction].bytes += bytes;
    },
    snapshot() {
      return {
        count: totals.count,
        bytes: totals.bytes,
        inbound: { ...totals.inbound },
        outbound: { ...totals.outbound },
        events: [...byEvent.values()]
          .map((metric) => ({
            eventName: metric.eventName,
            direction: metric.direction,
            count: metric.count,
            bytes: metric.bytes,
            payloadBytes: metric.payloadBytes.snapshot()
          }))
          .sort((a, b) => b.bytes - a.bytes || b.count - a.count)
      };
    },
    reset() {
      byEvent.clear();
      totals.count = 0;
      totals.bytes = 0;
      totals.inbound.count = 0;
      totals.inbound.bytes = 0;
      totals.outbound.count = 0;
      totals.outbound.bytes = 0;
    }
  };
}

export function createSmoothnessMetrics() {
  const rafFrameGaps = createFrameGapMetrics();
  const longTasks = createLongTaskMetrics();
  const socket = createSocketMetrics();
  const deltaApply = createDurationMetrics();

  return {
    recordRafFrame(frameAt: number) {
      rafFrameGaps.recordFrame(frameAt);
    },
    resetRafClock() {
      rafFrameGaps.resetClock();
    },
    recordSocketEvent(eventName: string, payload: unknown, direction: SocketMetricDirection = 'inbound') {
      socket.record(eventName, payload, direction);
    },
    measureDeltaApply<T>(callback: () => T) {
      return deltaApply.measure(callback);
    },
    recordDeltaApply(durationMs: number) {
      deltaApply.record(durationMs);
    },
    startLongTaskObserver() {
      return longTasks.start();
    },
    stopLongTaskObserver() {
      longTasks.stop();
    },
    snapshot(): SmoothnessSnapshot {
      return {
        rafFrameGapMs: rafFrameGaps.snapshot(),
        longTasks: longTasks.snapshot(),
        socket: socket.snapshot(),
        deltaApplyMs: deltaApply.snapshot()
      };
    },
    reset() {
      rafFrameGaps.reset();
      longTasks.reset();
      socket.reset();
      deltaApply.reset();
    }
  };
}

function flagIsEnabled(value: string | null) {
  return value === '' || value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

export function smoothnessDebugEnabled() {
  if (typeof window === 'undefined') return false;

  try {
    const params = new URLSearchParams(window.location.search);
    for (const key of ['smoothness', 'debugSmoothness', 'loopduelSmoothness']) {
      if (flagIsEnabled(params.get(key))) return true;
    }
  } catch {
    // Ignore URL parsing errors from unusual embeds.
  }

  try {
    return flagIsEnabled(window.localStorage.getItem('loopduel.smoothnessDebug'));
  } catch {
    return false;
  }
}

export const loopduelSmoothnessMetrics = createSmoothnessMetrics();

export function recordSocketEvent(eventName: string, payload: unknown, direction: SocketMetricDirection = 'inbound') {
  loopduelSmoothnessMetrics.recordSocketEvent(eventName, payload, direction);
}

export function measureDeltaApply<T>(callback: () => T) {
  return loopduelSmoothnessMetrics.measureDeltaApply(callback);
}

export function installSmoothnessDebug(metrics = loopduelSmoothnessMetrics) {
  if (typeof window === 'undefined' || !smoothnessDebugEnabled()) return false;

  metrics.startLongTaskObserver();
  window.__loopduelSmoothness = {
    snapshot: () => metrics.snapshot(),
    reset: () => metrics.reset(),
    log: () => {
      const snapshot = metrics.snapshot();
      console.info('[loopduel:smoothness]', snapshot);
      return snapshot;
    }
  };
  return true;
}

installSmoothnessDebug();
