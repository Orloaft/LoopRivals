export type GameplayRafFrame = {
  now: number;
  deltaMs: number;
  frameGapMs: number;
  frame: number;
};

export type GameplayRafSubscriber = (frame: GameplayRafFrame) => void;

export type GameplayRafDriver = {
  requestAnimationFrame: (callback: (time: number) => void) => number;
  cancelAnimationFrame: (handle: number) => void;
};

export type GameplayRafMetrics = {
  resetRafClock: () => void;
  recordRafFrame: (frameAt: number) => void;
};

const noopMetrics: GameplayRafMetrics = {
  resetRafClock: () => undefined,
  recordRafFrame: () => undefined
};

function browserRafDriver(): GameplayRafDriver {
  if (typeof window === 'undefined') {
    throw new Error('Gameplay RAF scheduler requires a requestAnimationFrame driver.');
  }

  return {
    requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
    cancelAnimationFrame: (handle) => window.cancelAnimationFrame(handle)
  };
}

export class GameplayRafScheduler {
  driver: GameplayRafDriver | null;
  metrics: GameplayRafMetrics;
  subscribers = new Set<GameplayRafSubscriber>();
  rafHandle: number | null = null;
  lastFrameAt: number | null = null;
  frame = 0;

  constructor(driver: GameplayRafDriver | null = null, metrics: GameplayRafMetrics = noopMetrics) {
    this.driver = driver;
    this.metrics = metrics;
  }

  get running() {
    return this.rafHandle !== null;
  }

  get subscriberCount() {
    return this.subscribers.size;
  }

  subscribe(subscriber: GameplayRafSubscriber) {
    this.subscribers.add(subscriber);
    if (this.subscribers.size === 1) {
      this.lastFrameAt = null;
      this.metrics.resetRafClock();
    }
    this.schedule();

    return () => {
      this.subscribers.delete(subscriber);
      if (this.subscribers.size === 0) this.stop();
    };
  }

  schedule() {
    if (this.rafHandle !== null || this.subscribers.size === 0) return;
    const driver = this.driver ?? browserRafDriver();
    this.driver = driver;
    this.rafHandle = driver.requestAnimationFrame((frameAt) => this.tick(frameAt));
  }

  tick(frameAt: number) {
    this.rafHandle = null;
    if (this.subscribers.size === 0) {
      this.lastFrameAt = null;
      return;
    }

    const frameGapMs = this.lastFrameAt === null ? 0 : frameAt - this.lastFrameAt;
    const payload = {
      now: frameAt,
      deltaMs: this.lastFrameAt === null ? 0 : frameGapMs,
      frameGapMs,
      frame: this.frame
    };

    this.frame += 1;
    this.lastFrameAt = frameAt;
    this.metrics.recordRafFrame(frameAt);

    for (const subscriber of [...this.subscribers]) subscriber(payload);

    this.schedule();
  }

  stop() {
    if (this.rafHandle !== null) {
      this.driver?.cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    this.lastFrameAt = null;
    this.metrics.resetRafClock();
  }
}

export function createGameplayRafScheduler(driver?: GameplayRafDriver, metrics: GameplayRafMetrics = noopMetrics) {
  return new GameplayRafScheduler(driver ?? null, metrics);
}

export const gameplayRaf = createGameplayRafScheduler();

export function configureGameplayRafMetrics(metrics: GameplayRafMetrics) {
  gameplayRaf.metrics = metrics;
}
