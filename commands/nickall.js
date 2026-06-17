"use strict";

const fmt               = require("../utils/fmt");
const config            = require("../config.json");
const { lockedNicknames } = require("../utils/nicknameLocks");

function buildNick(template, name, index, id) {
  return template
    .replace(/\{name\}/g,  name)
    .replace(/\{index\}/g, index)
    .replace(/\{id\}/g,    id);
}

function _delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

const USAGE_LINES = [
  "-nickall <كنية>              — تغيير كنيات الجميع",
  "-nickall lock <كنية>         — تغيير + قفل كنيات الجميع",
  "-nickall unlock              — فك قفل جميع الكنيات",
  "-nickall clear               — حذف جميع الكنيات وأقفالها",
  "",
  "متغيرات في الكنية:",
  "  {name}  → اسم العضو الأصلي",
  "  {index} → رقم العضو (1، 2، 3...)",
];

module.exports = {
  name: "nickall",
  aliases: ["na", "allnick"],
  description: "تغيير كنيات جميع أعضاء المجموعة دفعةً واحدة مع إمكانية القفل.",
  usage: USAGE_LINES.join("\n"),
  category: "Group",
  groupOnly: true,
  adminOnly: true,

  async execute({ api, event, args }) {
    const sub      = (args[0] || "").toLowerCase();
    const threadID = event.threadID;
    const prefix   = config.prefix;

    // ── unlock ────────────────────────────────────────────────────────────
    if (sub === "unlock") {
      if (!lockedNicknames.has(threadID)) {
        return api.sendMessage(
          [fmt.header(), "", fmt.wrn("لا توجد كنيات مقفولة في هذه المجموعة.")].join("\n"),
          threadID
        );
      }
      lockedNicknames.delete(threadID);
      return api.sendMessage(
        [fmt.header(), "", fmt.ok("تم فك قفل جميع الكنيات.")].join("\n"),
        threadID
      );
    }

    // ── clear: حذف كل الكنيات دفعةً ──────────────────────────────────────
    if (sub === "clear") {
      lockedNicknames.delete(threadID);

      let info;
      try { info = await api.getThreadInfo(threadID); }
      catch (e) { return api.sendMessage(fmt.err("فشل جلب معلومات المجموعة: " + e.message), threadID); }

      const ids = info.participantIDs || [];
      if (!ids.length) return api.sendMessage(fmt.wrn("لا يوجد أعضاء في المجموعة."), threadID);

      await api.sendMessage(
        [fmt.header(), "", "⏳ جارٍ حذف كنيات " + ids.length + " عضو..."].join("\n"),
        threadID
      );

      let done = 0, failed = 0;
      for (const uid of ids) {
        try { await api.nickname("", threadID, uid); done++; } catch { failed++; }
        await _delay(400);
      }

      return api.sendMessage(
        [
          fmt.header(),
          "",
          fmt.ok("تم حذف كل الكنيات وإزالة جميع الأقفال."),
          "",
          fmt.row("نجح",  String(done),   "✅"),
          fmt.row("فشل",  String(failed), "❌"),
        ].join("\n"),
        threadID
      );
    }

    // ── lock + set / set فقط ──────────────────────────────────────────────
    let doLock   = false;
    let template = "";

    if (sub === "lock") {
      doLock   = true;
      template = args.slice(1).join(" ").trim();
    } else {
      template = args.join(" ").trim();
    }

    if (!template) {
      return api.sendMessage(
        [fmt.header(), "", ...USAGE_LINES].join("\n"),
        threadID
      );
    }

    let info;
    try { info = await api.getThreadInfo(threadID); }
    catch (e) { return api.sendMessage(fmt.err("فشل جلب معلومات المجموعة: " + e.message), threadID); }

    const ids = info.participantIDs || [];
    if (!ids.length) return api.sendMessage(fmt.wrn("لا يوجد أعضاء في المجموعة."), threadID);

    // جلب الأسماء بدفعات
    const userNames = {};
    const CHUNK = 50;
    for (let i = 0; i < ids.length; i += CHUNK) {
      try {
        const chunk = await api.getUserInfo(ids.slice(i, i + CHUNK));
        for (const [uid, u] of Object.entries(chunk || {})) {
          userNames[uid] = u.name || uid;
        }
      } catch {}
    }

    await api.sendMessage(
      [
        fmt.header(),
        "",
        "⏳ جارٍ تغيير كنيات " + ids.length + " عضو" + (doLock ? " + قفل 🔒" : "") + "...",
      ].join("\n"),
      threadID
    );

    if (doLock && !lockedNicknames.has(threadID)) {
      lockedNicknames.set(threadID, new Map());
    }

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
      ? [fmt.inf("جميع الكنيات مقفولة — تُطبَّق تلقائياً."), fmt.row("لفك القفل", prefix + "nickall unlock", "🔓")]
      : [fmt.row("للقفل", prefix + "nickall lock <كنية>", "🔒")];

    api.sendMessage(
      [
        fmt.header(),
        "",
        fmt.ok("انتهى تغيير الكنيات."),
        "",
        fmt.row("نجح",  String(done),   "✅"),
        fmt.row("فشل",  String(failed), "❌"),
        "",
        ...lockNote,
      ].join("\n"),
      threadID
    );
  },
};
