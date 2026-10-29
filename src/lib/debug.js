// Lightweight ESM debug logger
// Enable via: localStorage.debug = 'chee:*'
// Specific: localStorage.debug = 'chee:engine,chee:panel'
// Disable: localStorage.removeItem('debug')

import { includes, some, forEach } from 'lodash-es';

const PREFIX = 'chee';

let enabledNamespaces = [];

function parseDebugFlag() {
  try {
    const flag = localStorage.getItem('debug') || '';
    enabledNamespaces = flag ? flag.split(',').map((p) => p.trim()) : [];
  } catch { enabledNamespaces = []; }
}

parseDebugFlag();
try { window.addEventListener('storage', parseDebugFlag); } catch { /* no window */ }

function isEnabled(namespace) {
  return some(enabledNamespaces, (p) => p === '*' || p === `${PREFIX}:*` || includes(namespace, p));
}

const LEVELS = [['INF', 'info'], ['WRN', 'warn'], ['ERR', 'error']];
const LOG_BUFFER_SIZE = 200;
const ringBuffer = new Array(LOG_BUFFER_SIZE);
let ringHead = 0;
let ringCount = 0;

function pushLog(level, tag, args) {
  const entry = `${new Date().toISOString().slice(11, 23)} ${level} ${tag} ${args.map(String).join(' ')}`;
  ringBuffer[ringHead] = entry;
  ringHead = (ringHead + 1) % LOG_BUFFER_SIZE;
  if (ringCount < LOG_BUFFER_SIZE) ringCount++;
}

export function getLogBuffer() {
  if (ringCount < LOG_BUFFER_SIZE) return ringBuffer.slice(0, ringCount);
  return ringBuffer.slice(ringHead).concat(ringBuffer.slice(0, ringHead));
}

export { parseDebugFlag as refreshDebugFlag };

const cache = new Map();

export default function createDebug(namespace) {
  if (cache.has(namespace)) return cache.get(namespace);

  const tag = `[${namespace}]`;

  // Always buffered for "Copy debug info"; printed only when enabled
  const logger = (level, method) => (...args) => {
    pushLog(level, tag, args);
    if (isEnabled(namespace)) console[method](tag, ...args); // eslint-disable-line no-console
  };

  const log = logger('DBG', 'log');
  forEach(LEVELS, ([level, method]) => { log[method] = logger(level, method); });

  log.enabled = () => isEnabled(namespace);

  cache.set(namespace, log);
  return log;
}
