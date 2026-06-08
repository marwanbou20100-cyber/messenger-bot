"use strict";
  /**
   * humanDelay — makes every bot response feel human-typed.
   *
   * Flow per command:
   *   1. readPause   (180–700 ms) — simulate noticing / reading the message
   *   2. sendTypingIndicator starts
   *   3. thinkPause  (500–2200 ms) — simulate composing a reply
   *   4. command executes  →  response sent
   *   5. typing indicator stops (auto or explicit)
   *
   * Categories:
   *   INSTANT  — single-word answers (ping, id, roll, coinflip…)
   *   HEAVY    — commands that show their own "working…" message first
   *   MEDIUM   — everything else (group management, info, etc.)
   */

  function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function _rnd(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

  // ── Command buckets ───────────────────────────────────────────────────────────
  const INSTANT = new Set([
    "ping","pong",
    "id",
    "roll",
    "coinflip",
    "time",
    "emoji",
    "react",
    "uptime","up","stats",
  ]);

  const HEAVY = new Set([
    "ai","chat","gpt",
    "imagine","img","image","\u0635\u0648\u0631\u0629",
    "music","song","\u0627\u063a\u0646\u064a\u0629","\u0623\u063a\u0646\u064a\u0629","mp3",
    "lyrics","lyric","lrc","\u0643\u0644\u0645\u0627\u062a",
    "muhrik","\u0645\u062d\u0631\u0643",
    "announce","broadcast","ann",
  ]);

  // ── readPause: glance at the incoming message (proportional to word count) ───
  function readPause(messageText) {
    const words = String(messageText || "").trim().split(/\s+/).length;
    return _rnd(180, Math.min(650, 200 + words * 15));
  }

  // ── thinkPause: simulate typing before replying ───────────────────────────────
  function thinkPause(cmdName) {
    const n = String(cmdName || "").toLowerCase();
    if (INSTANT.has(n)) return _rnd(400,  900);   // 0.4–0.9 s
    if (HEAVY.has(n))   return _rnd(350,  750);   // 0.35–0.75 s  (they manage own delay)
    return _rnd(900, 2200);                        // 0.9–2.2 s  medium commands
  }

  // ── withTyping: full human-response wrapper ───────────────────────────────────
  // Usage:
  //   await humanDelay.withTyping(api, threadID, cmd.name, event.body, async () => {
  //     await cmd.execute(...)
  //   });
  async function withTyping(api, threadID, cmdName, messageText, fn) {
    // 1. Read pause
    await _sleep(readPause(messageText));

    // 2. Start typing indicator
    let stopTyping = null;
    try { stopTyping = await api.sendTypingIndicator(threadID); } catch {}

    // 3. Think pause
    await _sleep(thinkPause(cmdName));

    // 4. Execute
    try {
      return await fn();
    } finally {
      // 5. Stop typing (no-op if already auto-stopped by message send)
      try { if (typeof stopTyping === "function") stopTyping(); } catch {}
    }
  }

  module.exports = { withTyping, readPause, thinkPause, _sleep, _rnd };
  