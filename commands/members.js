"use strict";
  const fmt = require("../utils/fmt");

  module.exports = {
    name: "members",
    aliases: ["list", "ml", "أعضاء"],
    description: "عرض قائمة أعضاء المجموعة.",
    usage: "members",
    category: "Group",
    groupOnly: true,

    async execute({ api, event }) {
      let info;
      try { info = await api.getThreadInfo(event.threadID); }
      catch (e) { return api.sendMessage(fmt.err("تعذّر جلب معلومات المجموعة: " + e.message), event.threadID); }

      const participants = info.participantIDs || [];
      const adminSet     = new Set(info.adminIDs || []);
      const botID        = api.getCurrentUserID();

      let userInfoMap = {};
      try { userInfoMap = await api.getUserInfo(participants); } catch {}

      const admins  = [];
      const members = [];

      for (const id of participants) {
        const name = userInfoMap[id]?.name || id;
        if (id === botID) continue;
        if (adminSet.has(id)) admins.push(name);
        else members.push(name);
      }

      const lines = [
        fmt.header(),
        "",
        fmt.row("المجموعة",  info.threadName || "بدون اسم", "💬"),
        fmt.row("الأعضاء",   String(participants.length - 1), "👥"),
        fmt.row("المشرفون",  String(admins.length),           "🛡️"),
        "",
        fmt.divider(),
      ];

      if (admins.length) {
        lines.push("\n🛡️  المشرفون");
        admins.forEach((n, i) => lines.push("  " + (i + 1) + ".  " + n));
      }

      if (members.length) {
        lines.push("\n👥  الأعضاء");
        members.forEach((n, i) => lines.push("  " + (i + 1) + ".  " + n));
      }

      api.sendMessage(lines.join("\n"), event.threadID);
    },
  };
  