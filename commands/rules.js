"use strict";
  const fs     = require("fs");
  const path   = require("path");
  const config = require("../config.json");
  const fmt    = require("../utils/fmt");

  const FILE = path.resolve(__dirname, "../data/rules.json");
  function _load()   { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; } }
  function _save(d)  { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch {} }

  module.exports = {
    name: "rules",
    aliases: ["rule", "قوانين"],
    description: "عرض أو إدارة قوانين المجموعة.",
    usage: "rules  |  rules add <نص>  |  rules remove <رقم>  |  rules clear",
    category: "Group",
    groupOnly: true,

    async execute({ api, event, args }) {
      const { threadID, senderID } = event;
      const isAdmin = config.bot.adminIDs.includes(senderID);
      const data    = _load();
      const key     = threadID;
      if (!data[key]) data[key] = [];
      const sub = (args[0] || "").toLowerCase();

      // عرض القوانين
      if (!sub || sub === "list" || sub === "عرض") {
        if (!data[key].length) return api.sendMessage(fmt.inf("لم تُضَف قوانين لهذه المجموعة بعد."), threadID);
        const lines = [fmt.header(), "", "📜  قوانين المجموعة", fmt.divider()];
        data[key].forEach((r, i) => lines.push("  " + (i + 1) + ".  " + r));
        lines.push("", fmt.divider());
        return api.sendMessage(lines.join("\n"), threadID);
      }

      if (!isAdmin) return api.sendMessage(fmt.err("هذا الأمر للمشرفين فقط."), threadID);

      if (sub === "add" || sub === "اضف") {
        const text = args.slice(1).join(" ").trim();
        if (!text) return api.sendMessage(fmt.err("أدخل نص القانون."), threadID);
        data[key].push(text);
        _save(data);
        return api.sendMessage(fmt.ok("تمت إضافة القانون رقم " + data[key].length + "."), threadID);
      }

      if (sub === "remove" || sub === "حذف") {
        const idx = parseInt(args[1]) - 1;
        if (isNaN(idx) || idx < 0 || idx >= data[key].length) return api.sendMessage(fmt.err("رقم القانون غير صحيح."), threadID);
        const removed = data[key].splice(idx, 1)[0];
        _save(data);
        return api.sendMessage(fmt.ok("تم حذف القانون: " + removed.slice(0, 50)), threadID);
      }

      if (sub === "clear" || sub === "مسح") {
        data[key] = [];
        _save(data);
        return api.sendMessage(fmt.ok("تم مسح جميع قوانين المجموعة."), threadID);
      }

      api.sendMessage(fmt.err("أمر غير معروف. اكتب " + config.prefix + "rules للمساعدة."), threadID);
    },
  };
  