"use strict";
  const fs     = require("fs");
  const path   = require("path");
  const config = require("../config.json");
  const fmt    = require("../utils/fmt");

  const FILE    = path.resolve(__dirname, "../data/warns.json");
  const MAX     = 3;

  function _load() {
    try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; }
  }
  function _save(d) {
    try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch {}
  }

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
      const sub      = (args[0] || "").toLowerCase().replace(/^-+/, "");
      const warnings = _load();
      const gKey     = threadID;
      if (!warnings[gKey]) warnings[gKey] = {};

      // عرض التحذيرات
      if (sub === "warns" || sub === "list") {
        const targetID = Object.keys(mentions)[0] || args[1];
        if (targetID) {
          const w = warnings[gKey][targetID] || [];
          const name = Object.values(mentions)[0] || targetID;
          if (!w.length) return api.sendMessage(fmt.ok(name + " ليس لديه تحذيرات."), threadID);
          const lines = [fmt.header(), "", fmt.row("المستخدم", name, "👤"), fmt.divider()];
          w.forEach((r, i) => lines.push("  " + (i+1) + ".  " + r));
          return api.sendMessage(lines.join("\n"), threadID);
        }
        // كل التحذيرات في المجموعة
        const keys = Object.keys(warnings[gKey]);
        if (!keys.length) return api.sendMessage(fmt.ok("لا توجد تحذيرات في هذه المجموعة."), threadID);
        const lines = [fmt.header(), "", "⚠️  التحذيرات", fmt.divider()];
        keys.forEach(id => {
          const cnt = warnings[gKey][id]?.length || 0;
          if (cnt > 0) lines.push("  " + id + "  (" + cnt + "/" + MAX + ")");
        });
        return api.sendMessage(lines.join("\n"), threadID);
      }

      const targetID = Object.keys(mentions)[0] || args[0];
      if (!targetID) {
        return api.sendMessage(fmt.err("حدد المستخدم.\n  " + config.prefix + "warn @شخص [سبب]"), threadID);
      }
      if (targetID === senderID) return api.sendMessage(fmt.err("لا يمكنك تحذير نفسك."), threadID);
      if (config.bot.adminIDs.includes(targetID)) return api.sendMessage(fmt.err("لا يمكن تحذير المشرفين."), threadID);

      // رفع التحذير
      if (sub === "unwarn") {
        if (!warnings[gKey][targetID]?.length) return api.sendMessage(fmt.ok("لا توجد تحذيرات لهذا المستخدم."), threadID);
        warnings[gKey][targetID].pop();
        _save(warnings);
        const name = Object.values(mentions)[0] || targetID;
        return api.sendMessage(fmt.ok("تم رفع آخر تحذير عن " + name), threadID);
      }

      // إضافة تحذير
      const reason = args.slice(Object.keys(mentions).length ? 1 : 1).join(" ") || "بدون سبب";
      const name   = Object.values(mentions)[0] || targetID;
      if (!warnings[gKey][targetID]) warnings[gKey][targetID] = [];
      warnings[gKey][targetID].push(reason);
      _save(warnings);

      const count = warnings[gKey][targetID].length;
      const lines = [
        fmt.header(),
        "",
        fmt.row("المحذَّر", name,              "⚠️"),
        fmt.row("السبب",    reason,            "📝"),
        fmt.row("التحذيرات", count + " / " + MAX, "🔢"),
      ];

      if (count >= MAX) {
        lines.push("", fmt.divider(), "⛔  تجاوز الحد — جاري الطرد...");
        api.sendMessage(lines.join("\n"), threadID);
        try { await api.removeUserFromGroup(targetID, threadID); }
        catch (e) { api.sendMessage(fmt.err("تعذّر الطرد: " + e.message), threadID); }
        warnings[gKey][targetID] = [];
        _save(warnings);
      } else {
        lines.push("", fmt.wrn("تحذير " + count + " من " + MAX));
        api.sendMessage(lines.join("\n"), threadID);
      }
    },
  };
  