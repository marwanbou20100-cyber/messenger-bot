"use strict";
  const TTL_MS = 2 * 60 * 1000;
  const MAX_ENTRIES = 500;
  const _cache = new Map();

  function get(threadID, userID) {
    const key = threadID + ":" + userID;
    const entry = _cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > TTL_MS) { _cache.delete(key); return null; }
    return entry.isAdmin;
  }

  function set(threadID, userID, isAdmin) {
    const key = threadID + ":" + userID;
    if (_cache.size >= MAX_ENTRIES) {
      const oldest = [..._cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
      if (oldest) _cache.delete(oldest[0]);
    }
    _cache.set(key, { isAdmin, ts: Date.now() });
  }

  function invalidate(threadID) {
    for (const k of _cache.keys()) {
      if (k.startsWith(threadID + ":")) _cache.delete(k);
    }
  }

  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of _cache) { if (now - v.ts > TTL_MS) _cache.delete(k); }
  }, 5 * 60 * 1000).unref();

  module.exports = { get, set, invalidate };
  