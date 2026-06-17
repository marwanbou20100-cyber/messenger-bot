"use strict";
  const config      = require("../config.json");
  const fmt         = require("../utils/fmt");
  const warnManager = require("../utils/warnManager");

  const MAX = 3;

  module.exports = {
    name: "warn",
    aliases: ["warning", "warns", "unwarn", "تحذير"],
    description: "تحذير عضو. عند الوصول لـ 3 تحذيرات يُطرد.",
    usage: "warn @شخص [سبب]  |  warns @شخص  |  unwarn @شخص",
    category: "Group",
    groupOnly: true,
    adminOnly: true,

    async execute({ api, event, args }) {
      const { threadID, senderID, mentions } = event;
      const sub = (args[0] || "").toLowerCase().replace(/^-+/, "");

      // عرض التحذيرات
      if (sub === "warns" || sub === "list") {
        const targetID = Object.keys(mentions)[0] || args[1];
        if (targetID) {
          const w    = warnManager.getWarns(threadID, targetID);
          const name = Object.values(mentions)[0] || targetID;
          if (!w.count) return api.sendMessage(fmt.ok(name + " ليس لديه تحذيرات."), threadID);
          const lines = [fmt.header(), "", fmt.row("المستخدم", name, "👤"), fmt.divider()];
          (w.reasons || []).forEach((r, i) => lines.push("  " + (i+1) + ".  " + (r.reason || r)));
          lines.push("", fmt.row("الإجمالي", w.count + " / " + MAX, "🔢"));
          return api.sendMessage(lines.join("\n"), threadID);
        }
        // كل التحذيرات في المجموعة
        const all = warnManager.listWarns(threadID);
        if (!all.length) return api.sendMessage(fmt.ok("لا توجد تحذيرات في هذه المجموعة."), threadID);
        const lines = [fmt.header(), "", "⚠️  التحذيرات", fmt.divider()];
        all.forEach(({ userID, count }) => {
          if (count > 0) lines.push("  " + userID + "  (" + count + "/" + MAX + ")");
        });
        return api.sendMessage(lines.join("\n"), threadID);
      }

      const targetID = Object.keys(mentions)[0] || args[0];
      if (!targetID) {
        return api.sendMessage(fmt.err("حدد المستخدم.\n  " + config.prefix + "warn @شخص [سبب]"), threadID);
      }
      if (targetID === senderID) return api.sendMessage(fmt.err("لا يمكنك تحذير نفسك."), threadID);
      if ((config.bot.adminIDs || []).includes(String(targetID))) return api.sendMessage(fmt.err("لا يمكن تحذير المشرفين."), threadID);

      // رفع التحذير
      if (sub === "unwarn") {
        const w = warnManager.getWarns(threadID, targetID);
        if (!w.count) return api.sendMessage(fmt.ok("لا توجد تحذيرات لهذا المستخدم."), threadID);
        // إزالة آخر تحذير — نمسح الكل ثم نُعيد السابق ناقص الأخير
        const remaining = (w.reasons || []).slice(0, -1);
        warnManager.clearWarns(threadID, targetID);
        for (const r of remaining) warnManager.addWarn(threadID, targetID, r.reason || r);
        const name = Object.values(mentions)[0] || targetID;
        return api.sendMessage(fmt.ok("تم رفع آخر تحذير عن " + name), threadID);
      }

      // إضافة تحذير
      const reason = args.slice(Object.keys(mentions).length ? 1 : 1).join(" ") || "بدون سبب";
      const name   = Object.values(mentions)[0] || targetID;
      const w      = warnManager.addWarn(threadID, targetID, reason);
      const count  = w.count;

      const lines = [
        fmt.header(),
        "",
        fmt.row("المحذَّر",   name,                  "⚠️"),
        fmt.row("السبب",      reason,                "📝"),
        fmt.row("التحذيرات", count + " / " + MAX,   "🔢"),
      ];

      if (count >= MAX) {
        lines.push("", fmt.divider(), "⛔  تجاوز الحد — جاري الطرد...");
        api.sendMessage(lines.join("\n"), threadID);
        try {
          await api.removeUserFromGroup(targetID, threadID);
          warnManager.clearWarns(threadID, targetID);
        } catch (e) {
          api.sendMessage(fmt.err("تعذّر الطرد: " + e.message), threadID);
        }
      } else {
        lines.push("", fmt.wrn("تحذير " + count + " من " + MAX));
        api.sendMessage(lines.join("\n"), threadID);
      }
    },
  };
