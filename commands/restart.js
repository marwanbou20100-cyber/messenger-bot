"use strict";

const { spawn }  = require("child_process");
const fmt         = require("../utils/fmt");
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

    // احفظ الكوكيز قبل الخروج
    try { await cookieRefresher.emergencyFlush(); } catch {}

    // أنشئ عملية جديدة قبل الخروج (يعمل مع PM2 وبدونه)
    setTimeout(() => {
      try {
        const child = spawn(process.execPath, process.argv.slice(1), {
          cwd:      process.cwd(),
          env:      process.env,
          detached: true,
          stdio:    "inherit",
        });
        child.unref();
      } catch {}
      // exit(1) → process manager يعيد التشغيل تلقائياً
      process.exit(1);
    }, 2000);
  },
};
