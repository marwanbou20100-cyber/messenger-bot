"use strict";
  const config     = require("../config.json");
  const banManager = require("../utils/banManager");
  const fmt        = require("../utils/fmt");

  module.exports = {
    name: "ban",
    aliases: ["botban", "unban", "bans"],
    description: "حظر/رفع حظر مستخدم من استخدام البوت.",
    usage: "ban @شخص [سبب]  |  unban @شخص  |  bans",
    category: "Admin",
    adminOnly: true,

    async execute({ api, event, args }) {
      const { threadID, senderID, mentions } = event;
      const sub = (args[0] || "").toLowerCase().replace(/^-+/, "");

      // عرض قائمة المحظورين
      if (sub === "bans" || sub === "list") {
        const list = banManager.listBans();
        if (!list.length) return api.sendMessage(fmt.ok("لا يوجد مستخدمون محظورون."), threadID);
        const lines = [fmt.header(), "", "🚫  قائمة الحظر", fmt.divider()];
        list.forEach((b, i) => lines.push("  " + (i+1) + ".  " + (b.userID) + (b.reason ? "  (" + b.reason + ")" : "")));
        return api.sendMessage(lines.join("\n"), threadID);
      }

      const targetID = Object.keys(mentions)[0] || args[0];
      if (!targetID) {
        return api.sendMessage(
          fmt.header() + "\n\n" +
          fmt.row("الاستخدام", config.prefix + "ban @شخص [سبب]", "📌") + "\n" +
          fmt.row("رفع الحظر", config.prefix + "unban @شخص", "📌") + "\n" +
          fmt.row("القائمة",   config.prefix + "bans", "📋"),
          threadID
        );
      }

      // رفع الحظر
      if (sub === "unban") {
        const removed = banManager.unban(targetID);
        const name = Object.values(mentions)[0] || targetID;
        return api.sendMessage(
          removed ? fmt.ok("تم رفع حظر " + name + " ✅") : fmt.err("هذا المستخدم غير محظور."),
          threadID
        );
      }

      // فرض الحظر
      if (targetID === senderID) return api.sendMessage(fmt.err("لا يمكنك حظر نفسك."), threadID);
      if ((config.bot.adminIDs || []).includes(String(targetID))) return api.sendMessage(fmt.err("لا يمكن حظر المشرفين."), threadID);

      const reason = args.slice(Object.keys(mentions).length ? 1 : 1).join(" ") || "بدون سبب";
      const name   = Object.values(mentions)[0] || targetID;

      banManager.ban(targetID, { reason, bannedBy: senderID, threadID });

      api.sendMessage(
        [
          fmt.header(),
          "",
          fmt.row("المحظور", name,   "🚫"),
          fmt.row("السبب",   reason, "📝"),
          fmt.row("بواسطة",  String(senderID) === String((config.bot.adminIDs || [])[0]) ? "المشرف الرئيسي" : senderID, "🛡️"),
        ].join("\n"),
        threadID
      );
    },
  };
