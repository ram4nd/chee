import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { readFileSync } from 'node:fs';
import { MSG_READY, MSG_EVAL, MSG_ERROR } from '../../src/constants.js';

const WORKER_CODE = readFileSync(new URL('../../static/stockfish-worker.js', import.meta.url), 'utf8');

// Fake stockfish.js: records UCI commands; tests answer by calling engineSays()
const FAKE_SF = 'self.onmessage = (e) => { self.__commands.push(e.data); };';

let posted;
let fakeSelf;

function engineSays(line) { fakeSelf.postMessage(line); }
function send(msg) { fakeSelf.onmessage({ data: msg }); }
const evals = () => posted.filter((m) => m.type === MSG_EVAL);

beforeEach(() => {
  posted = [];
  fakeSelf = {
    __commands: [],
    __sfCode: FAKE_SF,
    __searchDepth: 12,
    postMessage: (m) => posted.push(m),
    fetch: vi.fn(),
  };
  vi.stubGlobal('self', fakeSelf);
  (0, eval)(WORKER_CODE); // eslint-disable-line no-eval
  engineSays('readyok');
});

describe('stockfish worker', () => {
  it('reports ready once the engine answers', () => {
    expect(posted).toEqual([{ type: MSG_READY }]);
    expect(fakeSelf.__commands).toContain('isready');
  });

  it('posts one result per finished search with the best move', () => {
    send({ type: 'position', fen: 'F1' });
    expect(fakeSelf.__commands).toContain('position fen F1');
    expect(fakeSelf.__commands).toContain('go depth 12');
    engineSays('info depth 1 score cp 10 pv e2e4');
    engineSays('info depth 12 score cp 35 pv e2e4');
    engineSays('bestmove e2e4 ponder e7e5');
    expect(evals()).toEqual([{
      type: MSG_EVAL, fen: 'F1', depth: 12, score: 35, mate: null, bestmove: 'e2e4',
    }]);
  });

  it('does not report a stopped search', () => {
    send({ type: 'position', fen: 'F1' });
    engineSays('info depth 3 score cp 10');
    send({ type: 'stop' });
    engineSays('bestmove e2e4');
    expect(evals()).toEqual([]);
  });

  it('switches to a new position without reporting the interrupted one', () => {
    send({ type: 'position', fen: 'F1' });
    engineSays('info depth 3 score cp 10');
    send({ type: 'position', fen: 'F2' });
    expect(fakeSelf.__commands.at(-1)).toBe('stop');
    engineSays('bestmove e2e4');
    engineSays('readyok');
    expect(fakeSelf.__commands).toContain('position fen F2');
    engineSays('info depth 12 score mate 2');
    engineSays('bestmove d1h5');
    expect(evals()).toEqual([{
      type: MSG_EVAL, fen: 'F2', depth: 12, score: null, mate: 2, bestmove: 'd1h5',
    }]);
  });

  it('reports a finished search without a score as an error', () => {
    send({ type: 'position', fen: 'F1' });
    engineSays('bestmove (none)');
    expect(posted.at(-1)).toEqual({ type: MSG_ERROR, message: expect.stringContaining('F1') });
  });
});
