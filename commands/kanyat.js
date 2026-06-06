"use strict";
  const { lockedNicknames } = require("../utils/nicknameLocks");
  const config = require("../config.json");

  function buildNick(template, name, index, id) {
    return template
      .replace(/\{name\}/g, name)
      .replace(/\{index\}/g, index)
      .replace(/\{id\}/g, id);
  }
  function _delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  const USAGE = [
    "-كنيات <كنية>              ← تغيير كنيات الجميع",
    "-كنيات قفل <كنية>          ← تغيير + قفل (لا يمكن لأحد تغييرها)",
    "-كنيات فتح                 ← فك قفل جميع الكنيات",
    "-كنيات مسح                 ← حذف جميع الكنيات",
    "",
    "المتغيرات في الكنية:",
    "  {name}  → اسم العضو الأصلي",
    "  {index} → رقم العضو (1، 2، 3...)",
  ].join("\n");

  module.exports = {
    name: "كنيات",
    aliases: ["kanyat", "nicknames"],
    description: "تغيير كنيات جميع أعضاء المجموعة.",
    usage: USAGE,
    category: "Group",
    groupOnly: true,
    adminOnly: true,

    async execute({ api, event, args }) {
      const { threadID } = event;
      const sub = (args[0] || "").trim();

      if (sub === "فتح" || sub === "unlock") {
        lockedNicknames.delete(threadID);
        return api.sendMessage("🔓 تم فك قفل جميع الكنيات.", threadID);
      }

      if (sub === "مسح" || sub === "clear") {
        lockedNicknames.delete(threadID);
        let info;
        try { info = await api.getThreadInfo(threadID); } catch (e) {
          return api.sendMessage("❌ فشل جلب معلومات المجموعة: " + e.message, threadID);
        }
        const ids = info.participantIDs || [];
        await api.sendMessage("⏳ جارٍ حذف كنيات " + ids.length + " عضو...", threadID);
        let done = 0, failed = 0;
        for (const uid of ids) {
          try { await api.nickname("", threadID, uid); done++; } catch { failed++; }
          await _delay(400);
        }
        return api.sendMessage(`✅ تم حذف الكنيات:\n• نجح: ${done}\n• فشل: ${failed}`, threadID);
      }

      let doLock = false;
      let template = "";
      if (sub === "قفل" || sub === "lock") {
        doLock   = true;
        template = args.slice(1).join(" ").trim();
      } else {
        template = args.join(" ").trim();
      }

      if (!template) return api.sendMessage("❌ استخدام:\n" + USAGE, threadID);

      let info;
      try { info = await api.getThreadInfo(threadID); } catch (e) {
        return api.sendMessage("❌ فشل جلب معلومات المجموعة: " + e.message, threadID);
      }
      const ids = info.participantIDs || [];
      if (ids.length === 0) return api.sendMessage("❌ لا يوجد أعضاء في المجموعة.", threadID);

      let userNames = {};
      for (let i = 0; i < ids.length; i += 50) {
        try {
          const chunk = await api.getUserInfo(ids.slice(i, i + 50));
          for (const [uid, u] of Object.entries(chunk || {})) userNames[uid] = u.name || uid;
        } catch {}
      }

      const lockMode = doLock ? " + قفل 🔒" : "";
      await api.sendMessage(
        `⏳ جارٍ تغيير كنيات ${ids.length} عضو${lockMode}...\nالكنية: «${template}»`,
        threadID
      );

      if (doLock && !lockedNicknames.has(threadID)) lockedNicknames.set(threadID, new Map());

      let done = 0, failed = 0;
      for (let i = 0; i < ids.length; i++) {
        const uid  = ids[i];
        const name = userNames[uid] || uid;
        const nick = buildNick(template, name, i + 1, uid);
        try {
          await api.nickname(nick, threadID, uid);
          if (doLock) lockedNicknames.get(threadID).set(uid, nick);
          done++;
        } catch { failed++; }
        await _delay(500);
      }

      const lockNote = doLock
        ? "\n🔒 الكنيات مقفولة — تُطبَّق تلقائياً."
        : `\nللقفل: ${config.prefix}كنيات قفل <كنية>`;

      return api.sendMessage(
        `✅ انتهى تغيير الكنيات:\n• نجح : ${done}\n• فشل  : ${failed}${lockNote}`,
        threadID
      );
    },
  };
  