"use strict";

const config = require("../config.json");
const fmt    = require("../utils/fmt");

const COMMANDS = [
  { cmd: "help",           desc: "عرض هذه القائمة" },
  { cmd: "control",        desc: "التحكم بإعدادات البوت" },
  { cmd: "rename",         desc: "تغيير اسم المجموعة / قفله" },
  { cmd: "rename unlock",  desc: "رفع قفل اسم المجموعة" },
  { cmd: "nickname",       desc: "تعيين / قفل / مسح الكنيات" },
  { cmd: "lock",           desc: "قفل البوت — لا يستجيب إلا للمشرفين" },
  { cmd: "uptime",         desc: "مدة تشغيل البوت" },
  { cmd: "autoreply",      desc: "الردود التلقائية" },
  { cmd: "simstatus",      desc: "حالة محاكي الإنسان" },
  { cmd: "cookiestatus",   desc: "حالة تحديث الكوكيز" },
];

module.exports = {
  name: "help",
  aliases: ["مساعدة", "commands", "cmds"],
  description: "عرض قائمة الأوامر المتاحة.",
  usage: "help",
  category: "General",

  async execute({ api, event }) {
    const p     = config.prefix;
    const name  = (config.bot && config.bot.name) || "Phoenix";
    const lines = [
      fmt.header(),
      "",
      "🤖  " + name + " — الأوامر المتاحة",
      fmt.divider(),
    ];

    for (const { cmd, desc } of COMMANDS) {
      lines.push(fmt.row(p + cmd, desc, "›"));
    }

    lines.push(
      "",
      fmt.divider(),
      fmt.inf("جميع الأوامر تبدأ بـ  " + p),
    );

    api.sendMessage(lines.join("\n"), event.threadID);
  },
};
