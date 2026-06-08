"use strict";
  const fmt = require("../utils/fmt");
  module.exports = {
    name: "time",
    aliases: ["date", "وقت"],
    description: "عرض الوقت والتاريخ الحاليين.",
    usage: "time [timezone]",
    category: "Utility",
    async execute({ api, event, args }) {
      const tz  = args[0] || "Asia/Riyadh";
      let   now, tzLabel;
      try {
        now     = new Date().toLocaleString("ar-SA", { timeZone: tz, dateStyle: "full", timeStyle: "medium" });
        tzLabel = tz;
      } catch {
        now     = new Date().toLocaleString("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "full", timeStyle: "medium" });
        tzLabel = "Asia/Riyadh (افتراضي)";
      }
      api.sendMessage(
        [fmt.header(), "", fmt.row("التاريخ",     now,     "📅"), fmt.row("المنطقة", tzLabel, "🌍")].join("\n"),
        event.threadID
      );
    },
  };
  