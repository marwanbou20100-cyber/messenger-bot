"use strict";
  const os     = require("os");
  const config = require("../config.json");
  const fmt    = require("../utils/fmt");

  module.exports = {
    name: "info",
    aliases: ["about", "botinfo"],
    description: "معلومات تفصيلية عن البوت والخادم.",
    usage: "info",
    category: "General",

    async execute({ api, event }) {
      const upSec  = Math.floor(process.uptime());
      const memMB  = Math.round(process.memoryUsage().rss / 1048576);
      const botID  = api.getCurrentUserID();

      let groups = 0;
      try { const { groupsCache } = require("../state"); groups = groupsCache.size; } catch {}

      const msg = [
        fmt.header(),
        "",
        fmt.row("الاسم",      config.bot.name,     "🤖"),
        fmt.row("الإصدار",    "v" + config.bot.version, "🔖"),
        fmt.row("البادئة",    config.prefix,        "⌨️"),
        fmt.row("المعرف",     botID,                "🪪"),
        fmt.row("المجموعات",  String(groups),       "👥"),
        "",
        fmt.divider(),
        "",
        fmt.row("النظام",     os.platform() + " " + os.arch(), "🖥️"),
        fmt.row("Node.js",    process.version,      "🟩"),
        fmt.row("التشغيل",    fmt.uptime(upSec),    "⏱"),
        fmt.row("الذاكرة",    memMB + " MB",        "💾"),
        fmt.row("المعالج",    os.cpus().length + " نوى", "⚡"),
      ].join("\n");

      api.sendMessage(msg, event.threadID);
    },
  };
  