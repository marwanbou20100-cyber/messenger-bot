"use strict";

  /**
   * cookieRefresher.js v2
   * - Interval reduced to 2 minutes (was 4)
   * - Emergency flush available before process.exit()
   * - Tracks current API state reference for emergency use
   */

  const crypto = require("crypto");
  const logger  = require("./logger");

  const INTERVAL_MS  = 2 * 60 * 1000;   // 2 minutes
  const FIRST_TICK   = 20 * 1000;        // first tick 20s after start
  const MIN_PUSH_GAP = 45 * 1000;        // min 45s between pushes

  let _timer      = null;
  let _firstTimer = null;
  let _api        = null;
  let _session    = null;
  let _lastHash   = null;
  let _lastPushAt = 0;
  let _pushCount  = 0;
  let _skipCount  = 0;
  let _errorCount = 0;
  let _startedAt  = 0;

  function _hashState(state) {
    try { return crypto.createHash("sha1").update(JSON.stringify(state)).digest("hex"); }
    catch { return null; }
  }

  async function _tick() {
    if (!_api || !_session) return;
    let state;
    try { state = _api.getAppState(); }
    catch (e) { _errorCount++; logger.warn("CookieRefresher", "getAppState() failed: " + e.message); return; }

    if (!Array.isArray(state) || state.length === 0) return;

    // Auto-prune expired/duplicate cookies before comparing hash
    try {
      if (_session && typeof _session.pruneExpired === "function") {
        const { kept, removed } = _session.pruneExpired(state);
        if (removed > 0) state = kept; // use cleaned state for hash + save
      }
    } catch {}

    const hash    = _hashState(state);
    const now     = Date.now();
    const changed = hash && hash !== _lastHash;
    const gapOk   = now - _lastPushAt >= MIN_PUSH_GAP;

    if (!changed) { _skipCount++; return; }
    if (!gapOk)   { return; }

    try {
      const saved = await _session.saveAndPush(state);
      if (saved) {
        _lastHash   = hash;
        _lastPushAt = now;
        _pushCount++;
        logger.success("CookieRefresher",
          "Cookies saved & pushed ✅ (push #" + _pushCount + " | " + state.length + " entries)"
        );
      } else { _errorCount++; }
    } catch (e) {
      _errorCount++;
      logger.warn("CookieRefresher", "Push failed: " + e.message);
    }
  }

  /**
   * Emergency flush — call before process.exit() to guarantee session is saved.
   */
  async function emergencyFlush() {
    if (!_api || !_session) return;
    try {
      const state = _api.getAppState();
      if (Array.isArray(state) && state.length > 0) {
        _session.emergencySave(state);
        logger.success("CookieRefresher", "Emergency flush complete — session preserved ✅");
      }
    } catch (e) {
      logger.warn("CookieRefresher", "Emergency flush error: " + e.message);
    }
  }

  function start(api, session) {
    stop();
    _api        = api;
    _session    = session;
    _lastHash   = null;
    _lastPushAt = 0;
    _pushCount  = 0;
    _skipCount  = 0;
    _errorCount = 0;
    _startedAt  = Date.now();

    _firstTimer = setTimeout(() => {
      _firstTimer = null;
      _tick().catch(e => logger.warn("CookieRefresher", "First tick error: " + e.message));
      _timer = setInterval(
        () => _tick().catch(e => logger.warn("CookieRefresher", "Tick error: " + e.message)),
        INTERVAL_MS
      );
      if (_timer.unref) _timer.unref();
    }, FIRST_TICK);
    if (_firstTimer.unref) _firstTimer.unref();

    logger.info("CookieRefresher",
      "Started — first push in " + (FIRST_TICK / 1000) + "s, then every " + (INTERVAL_MS / 60000) + " min."
    );
  }

  function stop() {
    if (_firstTimer) { clearTimeout(_firstTimer);  _firstTimer = null; }
    if (_timer)      { clearInterval(_timer);       _timer      = null; }
    _api     = null;
    _session = null;
  }

  async function forceRefresh() {
    if (!_api || !_session) throw new Error("CookieRefresher not running.");
    _lastHash = null;
    await _tick();
    return status();
  }

  function status() {
    return {
      active:          !!_timer || !!_firstTimer,
      intervalMinutes: INTERVAL_MS / 60000,
      firstTickSec:    FIRST_TICK / 1000,
      pushCount:       _pushCount,
      skipCount:       _skipCount,
      errorCount:      _errorCount,
      lastPushAt:      _lastPushAt || null,
      uptimeSec:       _startedAt ? Math.floor((Date.now() - _startedAt) / 1000) : 0,
    };
  }

  module.exports = { start, stop, forceRefresh, status, emergencyFlush };
  