"use strict";

const fmt       = require("../utils/fmt");
const config    = require("../config.json");
const botAdmins = require("../utils/botAdmins");

module.exports = {
  name: "addadmin",
  aliases: ["removeadmin", "admins", "مشرف", "مشرفين"],
  description: "رفع عضو لمشرف بوت أو إزالته، عن طريق الرد على رسالته.",
  usage: [
    "-addadmin          ← بالرد على رسالة عضو: رفعه مشرفاً",
    "-removeadmin       ← بالرد على رسالة مشرف: إزالة صلاحياته",
    "-admins            ← عرض قائمة مشرفي البوت",
  ].join("\n"),
  category: "Admin",
  adminOnly: true,

  async execute({ api, event, args }) {
    const { threadID, senderID, messageReply } = event;
    const sub = (args[0] || "").toLowerCase();

    // ── قائمة المشرفين ─────────────────────────────────────────────────────
    if (sub === "admins" || sub === "list" || sub === "مشرفين") {
      const list = botAdmins.list();
      if (!list.length) {
        return api.sendMessage(
          [fmt.header(), "", fmt.wrn("لا يوجد مشرفو بوت مسجلون.")].join("\n"),
          threadID
        );
      }
      const lines = [fmt.header(), "", "👑  مشرفو البوت", fmt.divider()];
      list.forEach((id, i) => {
        const tag = i === 0 ? "  (مشرف رئيسي)" : "";
        lines.push("  " + (i + 1) + ".  " + id + tag);
      });
      return api.sendMessage(lines.join("\n"), threadID);
    }

    // ── إزالة مشرف ─────────────────────────────────────────────────────────
    if (sub === "removeadmin" || sub === "remove" || sub === "del") {
      // عن طريق الرد على رسالة
      const targetID = messageReply
        ? String(messageReply.senderID)
        : (Object.keys(event.mentions || {})[0] || args[1]);

      if (!targetID) {
        return api.sendMessage(
          fmt.err("ارد على رسالة الشخص الذي تريد إزالة صلاحياته، أو مَنشن."),
          threadID
        );
      }
      if (botAdmins.isPrimary(targetID)) {
        return api.sendMessage(fmt.err("لا يمكن إزالة المشرف الرئيسي."), threadID);
      }
      const removed = botAdmins.remove(targetID);
      return api.sendMessage(
        removed
          ? [fmt.header(), "", fmt.ok("تمت إزالة صلاحيات المشرف لـ " + targetID + ".")].join("\n")
          : fmt.wrn("هذا المستخدم ليس مشرفاً."),
        threadID
      );
    }

    // ── رفع مشرف (الحالة الافتراضية / addadmin) ────────────────────────────
    // يجب الرد على رسالة العضو
    const targetID = messageReply
      ? String(messageReply.senderID)
      : (Object.keys(event.mentions || {})[0] || args[0]);

    if (!targetID || targetID === "addadmin") {
      return api.sendMessage(
        [
          fmt.header(),
          "",
          fmt.row("رفع مشرف",   "رد على رسالة العضو ثم: " + config.prefix + "addadmin",    "👑"),
          fmt.row("إزالة مشرف", "رد على رسالته ثم: " + config.prefix + "removeadmin",       "🚫"),
          fmt.row("القائمة",    config.prefix + "admins",                                      "📋"),
        ].join("\n"),
        threadID
      );
    }

    if (String(targetID) === String(senderID)) {
      return api.sendMessage(fmt.err("لا يمكنك رفع نفسك."), threadID);
    }

    const added = botAdmins.add(targetID);
    return api.sendMessage(
      added
        ? [
            fmt.header(),
            "",
            fmt.ok("تم رفع " + targetID + " لمشرف بوت. 👑"),
            fmt.inf("يمكنه الآن استخدام جميع أوامر الأدمن."),
          ].join("\n")
        : fmt.wrn("هذا المستخدم مشرف بالفعل."),
      threadID
    );
  },
};
