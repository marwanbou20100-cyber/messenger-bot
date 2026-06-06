"use strict";
  const { lockedNames } = require("../utils/lockedNames");
  const { groupsCache }  = require("../state");

  // Active polling intervals: threadID → intervalID
  const _pollers = new Map();

  function _startPoller(api, threadID, name) {
    if (_pollers.has(threadID)) {
      clearInterval(_pollers.get(threadID));
      _pollers.delete(threadID);
    }
    const iv = setInterval(async () => {
      const locked = lockedNames.get(threadID);
      if (!locked) { clearInterval(iv); _pollers.delete(threadID); return; }
      try {
        const info = await api.getThreadInfo(threadID);
        const current = info.name || "";
        if (current && current !== locked) {
          await api.gcname(locked, threadID);
          // Update cache
          const c = groupsCache.get(threadID) || {};
          groupsCache.set(threadID, { ...c, name: locked });
        }
      } catch {}
    }, 5000);
    if (iv.unref) iv.unref();
    _pollers.set(threadID, iv);
  }

  module.exports = {
    name: "اسم",
    aliases: ["ism", "name-lock", "حماية-اسم"],
    description: "حماية اسم المجموعة — يُعيد الاسم كل 5 ثوانٍ إذا غُيِّر.",
    usage: [
      "-اسم <الاسم>  ← قفل الاسم المحدد وحمايته",
      "-اسم          ← قفل الاسم الحالي",
      "-اسم رفع      ← رفع الحماية",
    ].join("\n"),
    category: "Admin",
    adminOnly: true,
    groupOnly: true,

    async execute({ api, event, args }) {
      const { threadID } = event;
      const arg = args.join(" ").trim();

      if (arg === "رفع" || arg === "off" || arg === "نزع") {
        lockedNames.delete(threadID);
        if (_pollers.has(threadID)) { clearInterval(_pollers.get(threadID)); _pollers.delete(threadID); }
        return api.sendMessage("🔓 تم رفع حماية اسم المجموعة.", threadID);
      }

      let nameToLock = arg;
      if (!nameToLock) {
        try {
          const info = await api.getThreadInfo(threadID);
          nameToLock = info.name || "";
        } catch (e) {
          return api.sendMessage("❌ تعذّر جلب اسم المجموعة: " + e.message, threadID);
        }
      }

      if (!nameToLock) {
        return api.sendMessage(
          "❌ اكتب الاسم بعد الأمر:\n-اسم <الاسم المراد قفله>\nأو استخدم -اسم لقفل الاسم الحالي.", threadID
        );
      }

      // Set the name first if user specified one
      if (arg) {
        try { await api.gcname(nameToLock, threadID); } catch (e) {
          return api.sendMessage("❌ فشل تعيين الاسم. تأكد أن البوت مشرف.\n" + e.message, threadID);
        }
      }

      lockedNames.set(threadID, nameToLock);
      _startPoller(api, threadID, nameToLock);

      return api.sendMessage(
        "🏷️ تم تفعيل حماية الاسم:\n" +
        `«${nameToLock}»\n\n` +
        "سيُعاد تعيين الاسم كل 5 ثوانٍ إذا غُيِّر.\n" +
        "لرفع الحماية: -اسم رفع",
        threadID
      );
    },
  };
  