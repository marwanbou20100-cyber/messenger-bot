"use strict";
const botAdmins = require("../utils/botAdmins");

module.exports = {
  name: "botadmin",
  aliases: ["badmin", "مشرف-بوت"],
  description: "إدارة مشرفي البوت (إضافة/إزالة). للمشرف الرئيسي فقط.",
  usage: "botadmin list | add [ID] | remove [ID]",
  category: "Admin",

  async execute({ api, event, args }) {
    const { threadID, senderID, mentions } = event;

    if (!botAdmins.isAdmin(senderID))
      return api.sendMessage("⛔ هذا الأمر للمشرف الرئيسي فقط.", threadID);

    const sub = (args[0] || "list").toLowerCase();

    if (sub === "list") {
      const list  = botAdmins.list();
      const lines = list.map((id, i) =>
        "  " + (i + 1) + ". " + id + (i === 0 ? "  (رئيسي 👑)" : "")
      );
      return api.sendMessage([
        "┌─ 👑 مشرفو البوت (" + list.length + ") ──────────",
        "│",
        ...lines.map(l => "│" + l),
        "│",
        "│ -botadmin add [ID]    ← إضافة",
        "│ -botadmin remove [ID] ← إزالة",
        "└─────────────────────────────────",
      ].join("\n"), threadID);
    }

    if (sub === "add") {
      const targetID = String(Object.keys(mentions || {})[0] || args[1] || "").trim();
      if (!targetID || isNaN(targetID))
        return api.sendMessage("❌ الاستخدام: -botadmin add [ID]\nمثال: -botadmin add 100094978907051", threadID);
      if (botAdmins.add(targetID)) {
        api.sendMessage("✅ تمت إضافة " + targetID + " كمشرف في البوت. 🎖️", threadID);
        api.sendMessage("🎖️ مبروك! تمت ترقيتك كمشرف في البوت.\nيمكنك الآن استخدام جميع أوامر المشرفين.", targetID).catch(() => {});
      } else {
        api.sendMessage("⚠️ المعرّف " + targetID + " مشرف بالفعل.", threadID);
      }
      return;
    }

    if (sub === "remove") {
      const targetID = String(Object.keys(mentions || {})[0] || args[1] || "").trim();
      if (!targetID)
        return api.sendMessage("❌ الاستخدام: -botadmin remove [ID]", threadID);
      if (botAdmins.isPrimary(targetID))
        return api.sendMessage("⛔ لا يمكن إزالة المشرف الرئيسي.", threadID);
      if (botAdmins.remove(targetID)) {
        api.sendMessage("✅ تمت إزالة " + targetID + " من مشرفي البوت.", threadID);
      } else {
        api.sendMessage("⚠️ " + targetID + " ليس مشرفاً أو لا يمكن إزالته.", threadID);
      }
      return;
    }

    return api.sendMessage([
      "❓ أوامر botadmin:",
      "  -botadmin list        ← قائمة المشرفين",
      "  -botadmin add [ID]    ← إضافة مشرف",
      "  -botadmin remove [ID] ← إزالة مشرف",
    ].join("\n"), threadID);
  },
};
