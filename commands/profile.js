"use strict";
  const fmt = require("../utils/fmt");

  module.exports = {
    name: "profile",
    aliases: ["userinfo", "whois", "ملف"],
    description: "عرض معلومات مستخدم بالإشارة أو المعرف.",
    usage: "profile [@إشارة | معرف]",
    category: "Utility",

    async execute({ api, event, args }) {
      const mentions  = event.mentions || {};
      const mentionID = Object.keys(mentions)[0];
      const targetID  = mentionID || args[0] || event.senderID;

      let data;
      try { data = await api.getUserInfo([targetID]); }
      catch (e) { return api.sendMessage(fmt.err("تعذّر جلب البيانات: " + e.message), event.threadID); }

      const u = data[targetID];
      if (!u) return api.sendMessage(fmt.err("المستخدم غير موجود."), event.threadID);

      const name    = u.name      || "—";
      const gender  = u.gender === "male" ? "ذكر 👦" : u.gender === "female" ? "أنثى 👧" : "—";
      const type    = u.type      || "user";
      const vanity  = u.vanity    ? "fb.com/" + u.vanity : "—";

      const msg = [
        fmt.header(),
        "",
        fmt.row("الاسم",    name,     "👤"),
        fmt.row("المعرف",   targetID, "🪪"),
        fmt.row("الجنس",    gender,   "🧬"),
        fmt.row("النوع",    type,     "🏷️"),
        fmt.row("الرابط",   vanity,   "🔗"),
      ].join("\n");

      api.sendMessage(msg, event.threadID);
    },
  };
  