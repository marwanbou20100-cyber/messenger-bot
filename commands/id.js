"use strict";
  const fmt = require("../utils/fmt");

  module.exports = {
    name: "id",
    aliases: ["myid", "uid", "معرف"],
    description: "عرض معرف المستخدم أو المجموعة.",
    usage: "id [@mention]",
    category: "General",

    async execute({ api, event }) {
      const { threadID, senderID, mentions } = event;
      const mentioned = Object.keys(mentions || {})[0];
      const targetID  = mentioned || senderID;

      let name = targetID;
      try {
        const info = await api.getUserInfo([targetID]);
        name = info[targetID]?.name || targetID;
      } catch {}

      const msg = [
        fmt.header(),
        "",
        fmt.row("المستخدم",   name,           "👤"),
        fmt.row("المعرف",     targetID,       "🪪"),
        fmt.row("المجموعة",   threadID,       "💬"),
      ].join("\n");

      api.sendMessage(msg, event.threadID);
    },
  };
  