"use strict";
  const config = require("../config.json");
  const fmt    = require("../utils/fmt");

  module.exports = {
    name: "announce",
    aliases: ["ann", "broadcast", "اعلان"],
    description: "إرسال إعلان رسمي للمجموعة.",
    usage: "announce <الرسالة>",
    category: "Group",
    groupOnly: true,
    adminOnly: true,

    async execute({ api, event, args }) {
      const text = args.join(" ").trim();
      if (!text) {
        return api.sendMessage(
          fmt.err("أدخل نص الإعلان.\n  الاستخدام: " + config.prefix + "announce <الرسالة>"),
          event.threadID
        );
      }

      let senderName = event.senderID;
      try {
        const info = await api.getUserInfo([event.senderID]);
        senderName = info[event.senderID]?.name || event.senderID;
      } catch {}

      const msg = [
        "📢  إ ع ل ا ن",
        fmt.divider(),
        "",
        text,
        "",
        fmt.divider(),
        "◈ بواسطة  ·  " + senderName,
      ].join("\n");

      api.sendMessage(msg, event.threadID);
    },
  };
  