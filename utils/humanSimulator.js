"use strict";

/**
 * humanSimulator — makes the bot account look like a real human to Facebook.
 * Runs 24/7 non-stop with no night dampening or away periods.
 *
 * Behaviors:
 *  1. Presence heartbeat      — keeps account online continuously
 *  2. Typing indicator bursts — mimics composing a reply
 *  3. Periodic read marks     — mimics opening threads (delivered → read)
 *  4. Browse sessions         — scroll inbox: open → read → maybe type → next
 *  5. Reels / homepage        — simulates browsing feed
 *  6. Profile views           — occasionally views member profiles
 */

const logger = require("./logger");

const DEFAULT_CONFIG = {
  enabled:             true,
  presenceIntervalMs:  5  * 60_000,
  typingIntervalMs:    12 * 60_000,
  readIntervalMs:      4  * 60_000,
  browseIntervalMs:    18 * 60_000,
  jitterMs:            45_000,
  maxTypingMs:         5_000,
  maxGroupsPerCycle:   3,
  browseBatchSize:     6,
  reelsIntervalMs:     60 * 60_000,
};

let _api     = null;
let _cfg     = { ...DEFAULT_CONFIG };
let _timers  = [];
let _running = false;
let _stats   = {
  startedAt:       null,
  presenceSent:    0,
  typingSimulated: 0,
  threadsRead:     0,
  browseSessions:  0,
  reelsSessions:   0,
  profileViews:    0,
  lastActionAt:    null,
  lastActionType:  null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function _jitter(baseMs) {
  const j = _cfg.jitterMs || 45_000;
  return Math.max(5_000, baseMs + Math.floor((Math.random() * 2 - 1) * j));
}

function _randomGroupIDs(max) {
  try {
    const { groupsCache } = require("../state");
    const ids = [...groupsCache.keys()];
    if (ids.length === 0) return [];
    return ids.sort(() => Math.random() - 0.5).slice(0, max);
  } catch { return []; }
}

function _sleep(minMs, maxMs = minMs) {
  return new Promise(r => setTimeout(r, minMs + Math.floor(Math.random() * Math.max(0, maxMs - minMs))));
}

function _record(type) {
  _stats.lastActionAt   = Date.now();
  _stats.lastActionType = type;
}

function _schedule(fn, delayMs) {
  const t = setTimeout(fn, delayMs);
  t.unref();
  _timers.push(t);
}

// ── 1. Presence heartbeat ─────────────────────────────────────────────────────
function _doPresence() {
  _schedule(async () => {
    if (!_running || !_api) return;
    try {
      if (typeof _api.setOptions === "function") _api.setOptions({ online: true });
      _stats.presenceSent++;
      _record("presence");
      logger.debug("HumanSim", `Presence heartbeat #${_stats.presenceSent}`);
    } catch (e) { logger.debug("HumanSim", `Presence error: ${e.message}`); }
    _doPresence();
  }, _jitter(_cfg.presenceIntervalMs));
}

// ── 2. Typing simulation ──────────────────────────────────────────────────────
function _doTyping() {
  _schedule(async () => {
    if (!_running || !_api) return;
    const [threadID] = _randomGroupIDs(1);
    if (threadID) {
      try {
        // Mix: short reconsidering burst OR full composing duration
        const duration = Math.random() < 0.4
          ? 800  + Math.floor(Math.random() * 1_500)
          : 2_000 + Math.floor(Math.random() * (_cfg.maxTypingMs - 2_000));
        const stopFn = await _api.sendTypingIndicator(threadID);
        await _sleep(duration);
        if (typeof stopFn === "function") stopFn();
        _stats.typingSimulated++;
        _record("typing");
        logger.debug("HumanSim", `Typing in ${threadID} for ${duration}ms`);
      } catch (e) { logger.debug("HumanSim", `Typing error ${threadID}: ${e.message}`); }
    }
    _doTyping();
  }, _jitter(_cfg.typingIntervalMs));
}

// ── 3. Mark threads as read ───────────────────────────────────────────────────
function _doRead() {
  _schedule(async () => {
    if (!_running || !_api) return;
    for (const threadID of _randomGroupIDs(_cfg.maxGroupsPerCycle)) {
      try {
        // Human pattern: delivered first → pause → then read
        if (typeof _api.markAsDelivered === "function") {
          await _api.markAsDelivered(threadID).catch(() => {});
          await _sleep(1_200, 4_000);
        }
        await _api.markAsRead(threadID, true);
        _stats.threadsRead++;
        _record("markRead");
        logger.debug("HumanSim", `Marked ${threadID} as read`);
        await _sleep(500, 2_000);
      } catch (e) { logger.debug("HumanSim", `markAsRead error ${threadID}: ${e.message}`); }
    }
    _doRead();
  }, _jitter(_cfg.readIntervalMs));
}

// ── 4. Browse session ─────────────────────────────────────────────────────────
function _doBrowse() {
  _schedule(async () => {
    if (!_running || !_api) return;
    const batch = _randomGroupIDs(_cfg.browseBatchSize || 6);
    if (batch.length === 0) { _doBrowse(); return; }

    logger.debug("HumanSim", `Browse session — ${batch.length} threads`);

    for (const threadID of batch) {
      if (!_running) break;
      try {
        // Delivered → pause → read → maybe type → scroll
        if (typeof _api.markAsDelivered === "function") {
          await _api.markAsDelivered(threadID).catch(() => {});
          await _sleep(600, 2_000);
        }
        await _api.markAsRead(threadID, true);
        _stats.threadsRead++;
        _record("browse");

        // Reading time: quick glance (65%) or deep read (35%)
        const deep = Math.random() < 0.35;
        await _sleep(deep ? 4_000 : 1_000, deep ? 10_000 : 4_000);

        // 35% chance: start typing then abandon
        if (Math.random() < 0.35) {
          try {
            const stopFn = await _api.sendTypingIndicator(threadID);
            await _sleep(600, 2_500);
            if (typeof stopFn === "function") stopFn();
          } catch {}
        }

        await _sleep(300, 1_500);
      } catch (e) { logger.debug("HumanSim", `Browse error ${threadID}: ${e.message}`); }
    }

    _stats.browseSessions++;
    logger.debug("HumanSim", `Browse session #${_stats.browseSessions} complete`);
    _doBrowse();
  }, _jitter(_cfg.browseIntervalMs));
}

// ── 5. Reels / Homepage simulation ───────────────────────────────────────────
function _doReels() {
  _schedule(async () => {
    if (!_running || !_api) return;
    try {
      const botID   = _api.getCurrentUserID();
      const threads = _randomGroupIDs(3);
      logger.debug("HumanSim", "Reels/homepage simulation started");

      try { await _api.getUserInfo([botID]); } catch {}
      await _sleep(2_000, 5_000);

      for (const tid of threads) {
        if (!_running) break;
        try {
          if (typeof _api.markAsDelivered === "function") {
            await _api.markAsDelivered(tid).catch(() => {});
            await _sleep(800, 2_000);
          }
          await _api.markAsRead(tid, true);
          await _sleep(3_000, 12_000);

          if (Math.random() < 0.40) {
            try {
              const stopFn = await _api.sendTypingIndicator(tid);
              await _sleep(1_500, 4_000);
              if (typeof stopFn === "function") stopFn();
            } catch {}
          }
          await _sleep(1_000, 3_000);
        } catch {}
      }

      try {
        if (typeof _api.setOptions === "function") _api.setOptions({ online: true });
      } catch {}

      _stats.reelsSessions++;
      _record("reels");
      logger.debug("HumanSim", `Reels session #${_stats.reelsSessions} complete`);
    } catch (e) { logger.debug("HumanSim", `Reels error: ${e.message}`); }
    _doReels();
  }, _jitter(_cfg.reelsIntervalMs || 60 * 60_000));
}

// ── 6. Profile view simulation ────────────────────────────────────────────────
function _doProfileViews() {
  _schedule(async () => {
    if (!_running || !_api) return;
    try {
      const { groupsCache } = require("../state");
      const threadIDs = [...groupsCache.keys()];
      if (threadIDs.length === 0) { _doProfileViews(); return; }

      const threadID = threadIDs[Math.floor(Math.random() * threadIDs.length)];
      const info     = await _api.getThreadInfo(threadID).catch(() => null);
      if (!info) { _doProfileViews(); return; }

      const members = (info.participantIDs || []).filter(id => id !== _api.getCurrentUserID());
      if (members.length === 0) { _doProfileViews(); return; }

      const toView = members.sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 3));
      await _api.getUserInfo(toView).catch(() => {});
      _stats.profileViews += toView.length;
      _record("profileView");
      logger.debug("HumanSim", `Viewed ${toView.length} profile(s) from thread ${threadID}`);
      await _sleep(1_000, 3_000);
    } catch (e) { logger.debug("HumanSim", `Profile view error: ${e.message}`); }
    _doProfileViews();
  }, _jitter(40 * 60_000));
}

// ── Public API ────────────────────────────────────────────────────────────────
function start(api, userConfig = {}) {
  if (_running) stop();
  _api     = api;
  _cfg     = { ...DEFAULT_CONFIG, ...userConfig };
  _running = true;
  _timers  = [];
  _stats   = {
    startedAt:       Date.now(),
    presenceSent:    0,
    typingSimulated: 0,
    threadsRead:     0,
    browseSessions:  0,
    reelsSessions:   0,
    profileViews:    0,
    lastActionAt:    null,
    lastActionType:  null,
  };

  const stagger = [
    [_doPresence,      60_000 + Math.floor(Math.random() * 30_000)],
    [_doTyping,       100_000 + Math.floor(Math.random() * 30_000)],
    [_doRead,          35_000 + Math.floor(Math.random() * 15_000)],
    [_doBrowse,       300_000 + Math.floor(Math.random() * 60_000)],
    [_doReels,        600_000 + Math.floor(Math.random() * 120_000)],
    [_doProfileViews, 180_000 + Math.floor(Math.random() * 60_000)],
  ];
  for (const [fn, offset] of stagger) {
    const t = setTimeout(fn, offset);
    t.unref();
    _timers.push(t);
  }

  logger.info("HumanSim", [
    "Started (24/7) —",
    `presence:${_cfg.presenceIntervalMs / 60_000}m`,
    `typing:${_cfg.typingIntervalMs / 60_000}m`,
    `read:${_cfg.readIntervalMs / 60_000}m`,
    `browse:${_cfg.browseIntervalMs / 60_000}m`,
    `reels:${(_cfg.reelsIntervalMs || 3_600_000) / 60_000}m`,
    "+ profileViews",
  ].join(" "));
}

function stop() {
  _running = false;
  for (const t of _timers) clearTimeout(t);
  _timers = [];
  logger.info("HumanSim", "Stopped.");
}

function configure(newConfig) {
  _cfg = { ..._cfg, ...newConfig };
  if (_running && _api) { stop(); start(_api, _cfg); }
}

function status() {
  return { running: _running, config: { ..._cfg }, stats: { ..._stats } };
}

module.exports = { start, stop, configure, status };
