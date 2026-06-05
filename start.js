"use strict";
  /**
   * start.js — Auto-restart wrapper
   * Keeps the bot alive by restarting it on any unexpected exit.
   */
  const { spawn } = require("child_process");
  const path = require("path");

  const MAX_DELAY_MS  = 5 * 60 * 1000;
  const BASE_DELAY_MS = 5 * 1000;
  let attempt = 0;
  let startedAt = 0;
  let currentChild = null;

  function start() {
    startedAt = Date.now();
    attempt++;
    const delay = attempt > 1
      ? Math.min(BASE_DELAY_MS * Math.pow(1.8, attempt - 2), MAX_DELAY_MS)
      : 0;

    if (delay > 0) {
      console.log("[Wrapper] Restarting in " + Math.round(delay / 1000) + "s (attempt #" + attempt + ")...");
    } else {
      console.log("[Wrapper] Starting bot (attempt #" + attempt + ")...");
    }

    setTimeout(() => {
      currentChild = spawn(process.execPath, [path.join(__dirname, "index.js")], {
        stdio: "inherit",
        env: process.env,
      });

      currentChild.on("exit", (code, signal) => {
        currentChild = null;
        const uptime = Math.round((Date.now() - startedAt) / 1000);
        console.log("[Wrapper] Bot exited (code=" + code + ", signal=" + signal + ", uptime=" + uptime + "s)");

        if (uptime > 60) { attempt = 0; console.log("[Wrapper] Uptime > 1 min — resetting backoff."); }
        if (code === 0 && signal === null) { console.log("[Wrapper] Clean exit — not restarting."); return; }

        start();
      });

      currentChild.on("error", (e) => {
        console.error("[Wrapper] Spawn error:", e.message);
        currentChild = null;
        start();
      });
    }, delay);
  }

  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => {
      console.log("[Wrapper] " + sig + " — shutting down.");
      if (currentChild) currentChild.kill(sig);
      setTimeout(() => process.exit(0), 3000);
    });
  }

  start();
  