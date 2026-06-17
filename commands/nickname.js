"use strict";

const fmt               = require("../utils/fmt");
const config            = require("../config.json");
const { lockedNicknames } = require("../utils/nicknameLocks");

module.exports = {
  name: "nickname",
  aliases: ["nick", "nn", "كنية", "كنيات"],
  description: "تعيين، حذف، قفل أو فك قفل كنية عضو، أو مسح كل الكنيات دفعةً واحدة.",
  usage: [
    "-nickname set @شخص <كنية>   — تعيين كنية",
    "-nickname clear @شخص       — حذف كنية عضو",
    "-nickname lock @شخص <كنية> — قفل الكنية (تُطبَّق تلقائياً)",
    "-nickname unlock @شخص      — فك قفل الكنية",
    "-nickname locks             — عرض الكنيات المقفولة",
    "-nickname clearall          — حذف كل الكنيات وأقفالها دفعةً واحدة",
  ].join("\n"),
  category: "Group",
  groupOnly: true,
  adminOnly: true,

  async execute({ api, event, args }) {
    const sub        = (args[0] || "").toLowerCase();
    const mentions   = event.mentions || {};
    const mentionIDs = Object.keys(mentions);
    const { threadID } = event;
    const prefix     = config.prefix;

    // ── locks: عرض الكنيات المقفولة ────────────────────────────────────────
    if (sub === "locks") {
      const threadLocks = lockedNicknames.get(threadID);
      if (!threadLocks || threadLocks.size === 0) {
        return api.sendMessage(
          [fmt.header(), "", fmt.ok("لا توجد كنيات مقفولة في هذه المجموعة.")].join("\n"),
          threadID
        );
      }
      const lines = [fmt.header(), "", "🔒  الكنيات المقفولة (" + threadLocks.size + ")", fmt.divider()];
      for (const [uid] of threadLocks.entries()) {
        lines.push("  • " + uid);
      }
      return api.sendMessage(lines.join("\n"), threadID);
    }

    // ── clearall: حذف كل الكنيات دفعةً واحدة ──────────────────────────────
    if (sub === "clearall") {
      let info;
      try { info = await api.getThreadInfo(threadID); }
      catch (e) { return api.sendMessage(fmt.err("فشل جلب معلومات المجموعة: " + e.message), threadID); }

      const ids = info.participantIDs || [];
      if (!ids.length) return api.sendMessage(fmt.wrn("لا يوجد أعضاء في المجموعة."), threadID);

      await api.sendMessage(
        [fmt.header(), "", "⏳ جارٍ مسح كنيات " + ids.length + " عضو..."].join("\n"),
        threadID
      );

      let done = 0, failed = 0;
      for (const uid of ids) {
        try { await api.nickname("", threadID, uid); done++; } catch { failed++; }
        await new Promise(r => setTimeout(r, 400));
      }

      lockedNicknames.delete(threadID);

      return api.sendMessage(
        [
          fmt.header(),
          "",
          fmt.ok("تم مسح كل الكنيات وإزالة جميع الأقفال."),
          "",
          fmt.row("نجح",  String(done),   "✅"),
          fmt.row("فشل",  String(failed), "❌"),
        ].join("\n"),
        threadID
      );
    }

    // ── التحقق من وجود sub صحيح ────────────────────────────────────────────
    if (!["set", "clear", "lock", "unlock"].includes(sub)) {
      return api.sendMessage(
        [
          fmt.header(),
          "",
          fmt.row("تعيين",      prefix + "nickname set @شخص <كنية>",   "✏️"),
          fmt.row("حذف",        prefix + "nickname clear @شخص",         "🗑️"),
          fmt.row("قفل",        prefix + "nickname lock @شخص <كنية>",  "🔒"),
          fmt.row("فك قفل",    prefix + "nickname unlock @شخص",        "🔓"),
          fmt.row("المقفولة",   prefix + "nickname locks",              "📋"),
          fmt.row("مسح الكل",  prefix + "nickname clearall",            "💥"),
        ].join("\n"),
        threadID
      );
    }

    // ── أوامر تحتاج mention ─────────────────────────────────────────────────
    if (mentionIDs.length === 0) {
      return api.sendMessage(
        fmt.err("يجب ذكر شخص.\nمثال: " + prefix + "nickname " + sub + " @شخص" +
          (sub !== "clear" && sub !== "unlock" ? " <الكنية>" : "")),
        threadID
      );
    }

    const targetID   = mentionIDs[0];
    const targetName = (Object.values(mentions)[0] || "").replace(/@/, "") || targetID;

    // ── set ─────────────────────────────────────────────────────────────────
    if (sub === "set") {
      const nick = args.slice(2).join(" ").trim();
      if (!nick) return api.sendMessage(fmt.err("مثال: " + prefix + "nickname set @شخص كنيتي"), threadID);
      try {
        await api.nickname(nick, threadID, targetID);
        api.sendMessage(
          [fmt.header(), "", fmt.ok("تم تعيين الكنية لـ " + targetName + ".")].join("\n"),
          threadID
        );
      } catch (e) { api.sendMessage(fmt.err("فشل: " + e.message), threadID); }
    }

    // ── clear ────────────────────────────────────────────────────────────────
    else if (sub === "clear") {
      lockedNicknames.get(threadID)?.delete(targetID);
      try {
        await api.nickname("", threadID, targetID);
        api.sendMessage(
          [fmt.header(), "", fmt.ok("تم حذف كنية " + targetName + ".")].join("\n"),
          threadID
        );
      } catch (e) { api.sendMessage(fmt.err("فشل: " + e.message), threadID); }
    }

    // ── lock ─────────────────────────────────────────────────────────────────
    else if (sub === "lock") {
      const nick = args.slice(2).join(" ").trim();
      if (!nick) return api.sendMessage(fmt.err("مثال: " + prefix + "nickname lock @شخص كنيتي"), threadID);
      if (!lockedNicknames.has(threadID)) lockedNicknames.set(threadID, new Map());
      lockedNicknames.get(threadID).set(targetID, nick);
      try {
        await api.nickname(nick, threadID, targetID);
        api.sendMessage(
          [
            fmt.header(),
            "",
            fmt.ok("تم قفل كنية " + targetName + "."),
            fmt.inf("تُطبَّق تلقائياً كل دقيقة."),
            "",
            fmt.row("لفك القفل", prefix + "nickname unlock @" + targetName, "🔓"),
          ].join("\n"),
          threadID
        );
      } catch (e) { api.sendMessage(fmt.err("فشل: " + e.message), threadID); }
    }

    // ── unlock ───────────────────────────────────────────────────────────────
    else if (sub === "unlock") {
      const threadLocks = lockedNicknames.get(threadID);
      if (!threadLocks || !threadLocks.has(targetID)) {
        return api.sendMessage(
          [fmt.header(), "", fmt.wrn("كنية " + targetName + " ليست مقفولة.")].join("\n"),
          threadID
        );
      }
      threadLocks.delete(targetID);
      if (threadLocks.size === 0) lockedNicknames.delete(threadID);
      api.sendMessage(
        [fmt.header(), "", fmt.ok("تم فك قفل كنية " + targetName + ".")].join("\n"),
        threadID
      );
    }
  },
};
