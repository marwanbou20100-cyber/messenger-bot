"use strict";
  const config = require("../config.json");
  const fmt    = require("../utils/fmt");

  module.exports = {
    name: "kick",
    aliases: ["remove", "طرد"],
    description: "طرد عضو من المجموعة.",
    usage: "kick @شخص [سبب]",
    category: "Group",
    groupOnly: true,
    adminOnly: true,

    async execute({ api, event, args }) {
      const { threadID, senderID, mentions } = event;
      const targetID = Object.keys(mentions)[0] || args[0];

      if (!targetID) {
        return api.sendMessage(fmt.err("حدد العضو المراد طرده.\n  الاستخدام: " + config.prefix + "kick @شخص"), threadID);
      }
      if (targetID === senderID) return api.sendMessage(fmt.err("لا يمكنك طرد نفسك."), threadID);
      if (config.bot.adminIDs.includes(targetID)) return api.sendMessage(fmt.err("لا يمكن طرد المشرفين."), threadID);

      const reason = args.slice(1).join(" ") || "بدون سبب";
      const name   = Object.values(mentions)[0] || targetID;

      try {
        await api.removeUserFromGroup(targetID, threadID);
        api.sendMessage(
          [
            fmt.header(),
            "",
            fmt.row("المطرود", name,   "🦵"),
            fmt.row("السبب",   reason, "📝"),
          ].join("\n"),
          threadID
        );
      } catch (e) {
        api.sendMessage(fmt.err("تعذّر الطرد: " + e.message), threadID);
      }
    },
  };
  