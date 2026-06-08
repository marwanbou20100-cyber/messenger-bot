"use strict";
  const config      = require("../config.json");
  const fmt         = require("../utils/fmt");
  const { mutedThreads } = require("../state");

  module.exports = {
    name: "mute",
    aliases: ["unmute", "كتم"],
    description: "كتم/رفع كتم أوامر البوت في هذه المجموعة.",
    usage: "mute  |  unmute",
    category: "Group",
    groupOnly: true,
    adminOnly: true,

    async execute({ api, event, args }) {
      const { threadID } = event;
      const sub = (args[0] || "").toLowerCase();
      const isMuted = mutedThreads.has(threadID);

      if (!sub || sub === "status") {
        return api.sendMessage(
          fmt.header() + "\n\n" + fmt.row("حالة الكتم", isMuted ? "مكتوم 🔇" : "نشط 🔊", "💬"),
          threadID
        );
      }

      if (sub === "unmute" || sub === "رفع") {
        if (!isMuted) return api.sendMessage(fmt.wrn("المجموعة ليست مكتومة."), threadID);
        mutedThreads.delete(threadID);
        return api.sendMessage(fmt.ok("تم رفع الكتم — البوت نشط الآن. 🔊"), threadID);
      }

      // mute
      if (isMuted) return api.sendMessage(fmt.wrn("المجموعة مكتومة بالفعل."), threadID);
      mutedThreads.add(threadID);
      api.sendMessage(fmt.ok("تم كتم البوت في هذه المجموعة. 🔇\n  استخدم -unmute للرفع."), threadID);
    },
  };
  