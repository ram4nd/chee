import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { Engine } from '../../src/core/engine.js';
import {
  EVT_READY, EVT_EVAL, EVT_ERROR,
  MSG_READY, MSG_EVAL, MSG_ERROR, MSG_POSITION, MSG_STOP,
  SEARCH_DEPTH,
} from '../../src/constants.js';

let latestWorker;

beforeEach(() => {
  latestWorker = null;

  vi.stubGlobal('chrome', {
    runtime: { getURL: vi.fn((f) => `chrome-extension://abc/${f}`) },
  });

  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
    ok: true,
    text: () => Promise.resolve('worker-code'),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  })));

  vi.stubGlobal('Blob', class MockBlob {
    constructor(parts, opts) { this.parts = parts; this.opts = opts; }
  });

  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:mock'),
    revokeObjectURL: vi.fn(),
  });

  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => ''),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.stubGlobal('window', {
    addEventListener: vi.fn(),
    location: { hostname: 'chess.com' },
  });

  // Worker constructor captures the instance
  vi.stubGlobal('Worker', vi.fn(function MockWorker() {
    this.postMessage = vi.fn();
    this.terminate = vi.fn();
    this.onmessage = null;
    this.onerror = null;
    latestWorker = this;
  }));
});

describe('Engine', () => {
  describe('init', () => {
    it('transitions from IDLE to INITIALIZING to READY', async () => {
      const engine = new Engine();
      expect(engine.state).toBe('idle');

      await engine.init({ searchDepth: 22 });
      expect(engine.state).not.toBe('idle');

      latestWorker.onmessage({ data: { type: MSG_READY } });
      expect(engine.state).toBe('ready');
      engine.destroy();
    });

    it('emits EVT_READY when worker sends MSG_READY', async () => {
      const engine = new Engine();
      const fn = vi.fn();
      engine.on(EVT_READY, fn);

      await engine.init();
      latestWorker.onmessage({ data: { type: MSG_READY } });

      expect(fn).toHaveBeenCalled();
      engine.destroy();
    });

    it('is a no-op if not in IDLE state', async () => {
      const engine = new Engine();
      await engine.init();
      const fetchCount = fetch.mock.calls.length;
      await engine.init(); // should be a no-op
      expect(fetch.mock.calls.length).toBe(fetchCount);
      engine.destroy();
    });

    it('handles init failure gracefully', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network'))));

      const engine = new Engine();
      const fn = vi.fn();
      engine.on(EVT_ERROR, fn);

      await engine.init();

      expect(engine.state).toBe('error');
      expect(fn).toHaveBeenCalled();
      engine.destroy();
    });
  });

  describe('analyze', () => {
    it('posts MSG_POSITION and sets state to analyzing', async () => {
      const engine = new Engine();
      await engine.init();
      latestWorker.onmessage({ data: { type: MSG_READY } });

      engine.analyze('fen1');

      expect(engine.state).toBe('analyzing');
      expect(engine.currentFen).toBe('fen1');
      expect(latestWorker.postMessage).toHaveBeenCalledWith({ type: MSG_POSITION, fen: 'fen1', depth: SEARCH_DEPTH });
      engine.destroy();
    });

    it('analyses the same FEN again when asked', async () => {
      const engine = new Engine();
      await engine.init();
      latestWorker.onmessage({ data: { type: MSG_READY } });

      engine.analyze('fen1');
      engine.analyze('fen1');
      const positions = latestWorker.postMessage.mock.calls.filter((c) => c[0].type === MSG_POSITION);
      expect(positions).toHaveLength(2);
      engine.destroy();
    });

    it('queues FEN as pending when INITIALIZING', () => {
      const engine = new Engine();
      engine.init(); // don't await — stays in initializing
      engine.analyze('pendingFen');
      expect(engine.currentFen).toBeNull();
      engine.destroy();
    });

    it('analyzes pending FEN after MSG_READY', async () => {
      const engine = new Engine();
      await engine.init();
      engine.analyze('pendingFen');
      latestWorker.onmessage({ data: { type: MSG_READY } });

      expect(engine.currentFen).toBe('pendingFen');
      engine.destroy();
    });

    it('is a no-op when no worker', () => {
      const engine = new Engine();
      engine.analyze('test');
      expect(engine.currentFen).toBeNull();
    });
  });

  describe('stop', () => {
    it('posts MSG_STOP and sets state to ready', async () => {
      const engine = new Engine();
      await engine.init();
      latestWorker.onmessage({ data: { type: MSG_READY } });
      engine.analyze('fen1');

      engine.stop();

      expect(latestWorker.postMessage).toHaveBeenCalledWith({ type: MSG_STOP });
      expect(engine.state).toBe('ready');
      engine.destroy();
    });

    it('does not change state if not analyzing', async () => {
      const engine = new Engine();
      await engine.init();
      latestWorker.onmessage({ data: { type: MSG_READY } });

      engine.stop();
      expect(engine.state).toBe('ready');
      engine.destroy();
    });
  });

  describe('depth', () => {
    it('sends the depth from init with each position', async () => {
      const engine = new Engine();
      await engine.init({ searchDepth: 18 });
      latestWorker.onmessage({ data: { type: MSG_READY } });
      engine.analyze('fen1');
      expect(latestWorker.postMessage).toHaveBeenLastCalledWith({ type: MSG_POSITION, fen: 'fen1', depth: 18 });
      engine.destroy();
    });

    it('uses a changed depth for the next position', async () => {
      const engine = new Engine();
      await engine.init({ searchDepth: 18 });
      latestWorker.onmessage({ data: { type: MSG_READY } });
      engine.setDepth(12);
      engine.analyze('fen1');
      expect(latestWorker.postMessage).toHaveBeenLastCalledWith({ type: MSG_POSITION, fen: 'fen1', depth: 12 });
      engine.destroy();
    });
  });

  describe('_handleMessage', () => {
    it('MSG_EVAL emits EVT_EVAL', async () => {
      const engine = new Engine();
      const fn = vi.fn();
      engine.on(EVT_EVAL, fn);

      await engine.init();
      latestWorker.onmessage({ data: { type: MSG_READY } });
      engine.analyze('fen1');
      latestWorker.onmessage({
        data: {
          type: MSG_EVAL, fen: 'fen1', depth: 15, score: 30, mate: null,
        },
      });

      expect(fn).toHaveBeenCalledTimes(1);
      engine.destroy();
    });

    it('MSG_EVAL sets state to ready', async () => {
      const engine = new Engine();
      await engine.init();
      latestWorker.onmessage({ data: { type: MSG_READY } });
      engine.analyze('fen1');

      latestWorker.onmessage({ data: { type: MSG_EVAL, depth: 1 } });

      expect(engine.state).toBe('ready');
      engine.destroy();
    });

    it('MSG_ERROR emits EVT_ERROR and sets state to error', async () => {
      const engine = new Engine();
      const fn = vi.fn();
      engine.on(EVT_ERROR, fn);

      await engine.init();
      latestWorker.onmessage({ data: { type: MSG_ERROR, message: 'crash' } });

      expect(engine.state).toBe('error');
      expect(fn).toHaveBeenCalledWith('crash');
      engine.destroy();
    });
  });

  describe('_autoRecover', () => {
    it('recovers from a crash without reporting an error', async () => {
      const engine = new Engine();
      const errFn = vi.fn();
      engine.on(EVT_ERROR, errFn);

      await engine.init();
      latestWorker.onmessage({ data: { type: MSG_READY } });
      engine.analyze('fen1');

      latestWorker.onerror({ message: 'crash' });

      // A crash it can recover from is not reported as an error
      expect(errFn).not.toHaveBeenCalled();
      expect(engine.state).toBe('idle');
      engine.destroy();
    });

    it('gives up after MAX_RECOVER_ATTEMPTS for same FEN', async () => {
      vi.useFakeTimers();
      const engine = new Engine();
      const errFn = vi.fn();
      engine.on(EVT_ERROR, errFn);

      await engine.init();
      latestWorker.onmessage({ data: { type: MSG_READY } });
      engine.analyze('fen1');

      // First crash + recovery
      latestWorker.onerror({ message: 'crash1' });
      await vi.advanceTimersByTimeAsync(1100);

      // After recovery, init is called again → new worker created
      const w2 = latestWorker;
      w2.onmessage({ data: { type: MSG_READY } });
      // pendingFen should be analyzed
      // Second crash
      w2.onerror({ message: 'crash2' });
      await vi.advanceTimersByTimeAsync(1100);

      // Third attempt
      const w3 = latestWorker;
      w3.onmessage({ data: { type: MSG_READY } });
      // This crash should give up (attempt 3 > MAX_RECOVER_ATTEMPTS=2)
      w3.onerror({ message: 'crash3' });

      // Only giving up is reported
      expect(errFn).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
      engine.destroy();
    });
  });

  describe('crash while starting', () => {
    it('re-analyses the position queued before the engine was ready', async () => {
      vi.useFakeTimers();
      const engine = new Engine();
      await engine.init();
      engine.analyze('fen1'); // queued: engine not ready yet
      latestWorker.onerror({ message: 'crash' });
      await vi.advanceTimersByTimeAsync(1100);

      latestWorker.onmessage({ data: { type: MSG_READY } });
      expect(latestWorker.postMessage).toHaveBeenLastCalledWith({ type: MSG_POSITION, fen: 'fen1', depth: SEARCH_DEPTH });
      vi.useRealTimers();
      engine.destroy();
    });

    it('keeps a position requested while it restarts', async () => {
      vi.useFakeTimers();
      const engine = new Engine();
      await engine.init();
      latestWorker.onmessage({ data: { type: MSG_READY } });
      engine.analyze('fen1');
      latestWorker.onerror({ message: 'crash' });
      engine.analyze('fen2');
      await vi.advanceTimersByTimeAsync(1100);

      latestWorker.onmessage({ data: { type: MSG_READY } });
      expect(latestWorker.postMessage).toHaveBeenLastCalledWith({ type: MSG_POSITION, fen: 'fen2', depth: SEARCH_DEPTH });
      vi.useRealTimers();
      engine.destroy();
    });
  });

  describe('stop while starting', () => {
    it('drops the queued position', async () => {
      const engine = new Engine();
      await engine.init();
      engine.analyze('fen1');
      engine.stop();
      latestWorker.onmessage({ data: { type: MSG_READY } });
      const positions = latestWorker.postMessage.mock.calls.filter((c) => c[0].type === MSG_POSITION);
      expect(positions).toHaveLength(0);
      engine.destroy();
    });
  });

  describe('shutdown', () => {
    it('unloads the worker but keeps listeners so it can start again', async () => {
      const engine = new Engine();
      const ready = vi.fn();
      engine.on(EVT_READY, ready);
      await engine.init();
      const w = latestWorker;
      engine.analyze('fen1');

      engine.shutdown();
      expect(w.terminate).toHaveBeenCalled();
      expect(engine.state).toBe('idle');

      await engine.init();
      expect(latestWorker).not.toBe(w);
      latestWorker.onmessage({ data: { type: MSG_READY } });
      expect(ready).toHaveBeenCalledTimes(1);
      const positions = latestWorker.postMessage.mock.calls.filter((c) => c[0].type === MSG_POSITION);
      expect(positions).toHaveLength(0);
      engine.destroy();
    });
  });

  describe('init', () => {
    it('loads the wasm through the worker URL hash', async () => {
      const engine = new Engine();
      await engine.init();
      expect(Worker).toHaveBeenLastCalledWith('blob:mock#stockfish.wasm');
      engine.destroy();
    });

    it('reports a resource that failed to load', async () => {
      fetch.mockImplementation(() => Promise.resolve({
        ok: false, status: 404, text: () => Promise.resolve(''), arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      }));
      const engine = new Engine();
      const errFn = vi.fn();
      engine.on(EVT_ERROR, errFn);
      await engine.init();
      expect(errFn).toHaveBeenCalledWith(expect.stringContaining('HTTP 404'));
      engine.destroy();
    });
  });

  describe('destroy', () => {
    it('terminates worker and resets state', async () => {
      const engine = new Engine();
      await engine.init();
      const w = latestWorker;
      w.onmessage({ data: { type: MSG_READY } });

      engine.destroy();

      expect(w.terminate).toHaveBeenCalled();
      expect(engine.state).toBe('idle');
      expect(engine.currentFen).toBeNull();
    });

    it('clears recovery timer', async () => {
      vi.useFakeTimers();
      const engine = new Engine();
      await engine.init();
      latestWorker.onmessage({ data: { type: MSG_READY } });
      engine.analyze('fen1');
      latestWorker.onerror({ message: 'crash' });

      engine.destroy();

      expect(engine.state).toBe('idle');
      vi.useRealTimers();
    });
  });
});
