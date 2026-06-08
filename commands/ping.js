"use strict";
  const os  = require("os");
  const fmt = require("../utils/fmt");

  module.exports = {
    name: "ping",
    aliases: ["pong"],
    description: "فحص استجابة البوت وقياس زمن الرد.",
    usage: "ping",
    category: "General",

    async execute({ api, event }) {
      const latency = event.timestamp ? Date.now() - event.timestamp : null;
      const ms      = latency !== null ? latency + " ms" : "N/A";
      const upSec   = Math.floor(process.uptime());

      const msg = [
        fmt.header(),
        "",
        fmt.row("الحالة",    "نشط ✅",       "🟢"),
        fmt.row("الاستجابة", ms,              "📶"),
        fmt.row("التشغيل",   fmt.uptime(upSec), "⏱"),
        fmt.row("الذاكرة",   Math.round(process.memoryUsage().rss/1048576) + " MB", "💾"),
      ].join("\n");

      api.sendMessage(msg, event.threadID);
    },
  };
  