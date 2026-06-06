"use strict";
  const { totalLockedThreads } = require("../state");
  const config = require("../config.json");

  function isAdmin(id) { return (config.bot.adminIDs || []).includes(String(id)); }

  module.exports = {
    name: "قفل",
    aliases: ["qfl", "fulllock"],
    description: "قفل تام — البوت يتجاهل كل الرسائل والأوامر ولا يستجيب إلا للمشرف الرئيسي.",
    usage: "-قفل | -قفل رفع",
    category: "Admin",
    groupOnly: true,

    execute({ api, event, args }) {
      const { threadID, senderID } = event;
      if (!isAdmin(senderID)) return api.sendMessage("🔒 هذا الأمر للمشرف الرئيسي فقط.", threadID);

      const sub = (args[0] || "").trim();
      const isLocked = totalLockedThreads.has(threadID);

      if (sub === "رفع" || sub === "off" || sub === "فتح") {
        if (!isLocked) return api.sendMessage("ℹ️ القفل غير مفعّل في هذه المجموعة.", threadID);
        totalLockedThreads.delete(threadID);
        return api.sendMessage("🔓 تم رفع القفل التام.\nجميع الأعضاء يمكنهم التفاعل مع البوت الآن.", threadID);
      }

      if (isLocked) {
        totalLockedThreads.delete(threadID);
        return api.sendMessage("🔓 تم رفع القفل التام.\nجميع الأعضاء يمكنهم التفاعل مع البوت الآن.", threadID);
      }

      totalLockedThreads.add(threadID);
      return api.sendMessage(
        "🔒 تم تفعيل القفل التام.\n" +
        "البوت يتجاهل جميع الرسائل والأوامر من الأعضاء.\n" +
        "يستجيب فقط للمشرف الرئيسي.\n\n" +
        "لرفع القفل: -قفل رفع",
        threadID
      );
    },
  };
  