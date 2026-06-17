"use strict";

const fmt    = require("../utils/fmt");
const config = require("../config.json");

module.exports = {
  name: "restart",
  aliases: ["reboot", "إعادة"],
  description: "إعادة تشغيل البوت. (مشرف البوت فقط)",
  usage: "restart",
  category: "Admin",
  adminOnly: true,

  async execute({ api, event }) {
    const { threadID } = event;
    const name = (config.bot && config.bot.name) || "Phoenix";

    await api.sendMessage(
      [
        fmt.header(),
        "",
        "🔄 جارٍ إعادة تشغيل " + name + "...",
        fmt.inf("سيعود البوت خلال لحظات."),
      ].join("\n"),
      threadID
    ).catch(() => {});

    // تأخير قصير ليُرسل الرسالة أولاً ثم يُعيد التشغيل
    setTimeout(() => process.exit(0), 1500);
  },
};
