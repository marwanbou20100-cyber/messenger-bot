"use strict";
  const config = require("../config.json");
  const fmt    = require("../utils/fmt");

  module.exports = {
    name: "admin",
    aliases: ["addadmin", "removeadmin", "مشرف"],
    description: "ترقية/إزالة مشرف في المجموعة.",
    usage: "admin add @شخص  |  admin remove @شخص",
    category: "Group",
    groupOnly: true,
    adminOnly: true,

    async execute({ api, event, args }) {
      const { threadID, mentions } = event;
      const sub      = (args[0] || "").toLowerCase();
      const targetID = Object.keys(mentions)[0] || args[1];

      if (!sub || !targetID) {
        return api.sendMessage(
          fmt.header() + "\n\n" +
          fmt.row("ترقية",  config.prefix + "admin add @شخص",    "⬆️") + "\n" +
          fmt.row("إزالة",  config.prefix + "admin remove @شخص", "⬇️"),
          threadID
        );
      }

      const name   = Object.values(mentions)[0] || targetID;
      const adding = sub === "add" || sub === "اضف";

      try {
        await api.changeAdminStatus(threadID, [targetID], adding);
        api.sendMessage(
          adding
            ? fmt.ok("تمت ترقية " + name + " إلى مشرف. 🛡️")
            : fmt.ok("تمت إزالة صلاحيات المشرف عن " + name + "."),
          threadID
        );
      } catch (e) {
        api.sendMessage(fmt.err("تعذّر تغيير الصلاحية: " + e.message), threadID);
      }
    },
  };
  