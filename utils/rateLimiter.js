"use strict";

/**
 * GlobalRateLimiter
 * -----------------
 * A token-bucket + jitter queue that wraps every Facebook API call.
 * Prevents request bursts that trigger Facebook's automated account
 * suspension or MQTT disconnections.
 *
 * Usage (in index.js or any util):
 *   const rl = require('./rateLimiter');
 *   await rl.throttle();   // wait for a safe slot before each API call
 */

const config = (function () {
  try { return require("../config.json").rateLimit || {}; } catch { return {}; }
})();

const MIN_DELAY   = config.minDelayBetweenMs   || 1200;
const MAX_DELAY   = config.maxDelayBetweenMs   || 3500;
const MAX_WINDOW  = config.maxRequestsPerWindow || 18;
const WINDOW_MS   = config.windowMs            || 60000;
const BURST_CD    = config.burstCooldownMs     || 8000;

let _queue        = [];        // pending resolve callbacks
let _windowCount  = 0;         // requests in current window
let _windowStart  = Date.now();
let _processing   = false;
let _lastRequest  = 0;

function _jitter(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function _resetWindowIfNeeded() {
  const now = Date.now();
  if (now - _windowStart >= WINDOW_MS) {
    _windowStart  = now;
    _windowCount  = 0;
  }
}

async function _processQueue() {
  if (_processing) return;
  _processing = true;

  while (_queue.length > 0) {
    _resetWindowIfNeeded();

    // Window full → wait until it resets
    if (_windowCount >= MAX_WINDOW) {
      const waitUntil = _windowStart + WINDOW_MS + _jitter(500, 2000);
      await new Promise(r => setTimeout(r, waitUntil - Date.now()));
      _resetWindowIfNeeded();
    }

    // Enforce minimum gap between requests + random jitter
    const elapsed = Date.now() - _lastRequest;
    const gap      = _jitter(MIN_DELAY, MAX_DELAY);
    if (elapsed < gap) {
      await new Promise(r => setTimeout(r, gap - elapsed));
    }

    _windowCount++;
    _lastRequest = Date.now();

    const resolve = _queue.shift();
    resolve();

    // Extra cool-down after a burst (> 60% of window used)
    if (_windowCount >= Math.floor(MAX_WINDOW * 0.6)) {
      await new Promise(r => setTimeout(r, _jitter(BURST_CD / 2, BURST_CD)));
    }
  }

  _processing = false;
}

/**
 * throttle() — call before every Facebook API request.
 * Returns a Promise that resolves when it's safe to proceed.
 */
function throttle() {
  return new Promise(resolve => {
    _queue.push(resolve);
    _processQueue().catch(() => {});
  });
}

/** stats() — for dashboard / diagnostics */
function stats() {
  _resetWindowIfNeeded();
  return {
    queueLength:    _queue.length,
    windowCount:    _windowCount,
    windowCapacity: MAX_WINDOW,
    windowRemainsMs: Math.max(0, _windowStart + WINDOW_MS - Date.now()),
  };
}

module.exports = { throttle, stats };
