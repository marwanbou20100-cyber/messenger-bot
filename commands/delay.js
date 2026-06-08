"use strict";
  const fmt              = require("../utils/fmt");
  const { replyDelay }   = require("../state");

  module.exports = {
    name: "delay",
    aliases: ["تأخير", "antiban"],
    description: "تشغيل أو إيقاف تأخير الردود لحماية الحساب.",
    usage: "delay [on|off] [ثواني]",
    adminOnly: true,
    category: "Admin",

    async execute({ api, event, args }) {
      const { threadID } = event;
      const sub = (args[0] || "").toLowerCase();

      if (!sub) {
        const state = replyDelay.enabled
          ? "مُفعَّل ✅  ·  " + (replyDelay.ms / 1000) + " ثانية"
          : "مُعطَّل ❌";
        return api.sendMessage(
          [
            fmt.header(),
            "",
            fmt.row("الحالة",    state,           "⏱"),
            fmt.row("تشغيل",     "-delay on [ث]", "▶️"),
            fmt.row("إيقاف",     "-delay off",    "⏹"),
          ].join("\n"),
          threadID
        );
      }

      if (sub === "on" || sub === "تشغيل") {
        const sec = parseFloat(args[1]);
        replyDelay.ms = (!isNaN(sec) && sec > 0 && sec <= 10) ? Math.round(sec * 1000) : 1500;
        replyDelay.enabled = true;
        return api.sendMessage(fmt.ok("تأخير الردود مُفعَّل ·  " + replyDelay.ms / 1000 + " ثانية 🛡️"), threadID);
      }

      if (sub === "off" || sub === "إيقاف") {
        replyDelay.enabled = false;
        return api.sendMessage(fmt.ok("تأخير الردود مُعطَّل."), threadID);
      }

      const sec = parseFloat(sub);
      if (!isNaN(sec) && sec > 0 && sec <= 10) {
        replyDelay.ms = Math.round(sec * 1000);
        return api.sendMessage(fmt.ok("مدة التأخير: " + replyDelay.ms / 1000 + " ثانية"), threadID);
      }

      api.sendMessage(fmt.err("استخدام خاطئ.  مثال: -delay on 2"), threadID);
    },
  };
  