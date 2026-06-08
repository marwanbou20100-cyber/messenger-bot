"use strict";
  const config = require("../config.json");
  const fmt    = require("../utils/fmt");
  const cookieRefresher = require("../utils/cookieRefresher");

  module.exports = {
    name: "restart",
    aliases: ["reboot", "rs", "اعادة"],
    description: "حفظ الكوكيز وإعادة تشغيل البوت.",
    usage: "restart",
    category: "Admin",
    adminOnly: true,

    async execute({ api, event }) {
      const { threadID } = event;
      await api.sendMessage(
        [
          fmt.header(),
          "",
          fmt.row("الحالة", "جاري الحفظ وإعادة التشغيل...", "🔄"),
          fmt.row("المدة",  "~5 ثواني", "⏱"),
        ].join("\n"),
        threadID
      );
      // Emergency save before restart
      try { await cookieRefresher.emergencyFlush(); } catch {}
      setTimeout(() => process.exit(0), 2000);
    },
  };
  