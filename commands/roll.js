"use strict";
  const fmt = require("../utils/fmt");
  module.exports = {
    name: "roll",
    aliases: ["dice", "نرد"],
    description: "رمي نرد أو تحديد نطاق عشوائي.",
    usage: "roll [عدد الأوجه]  |  roll [min] [max]",
    category: "Fun",
    async execute({ api, event, args }) {
      let result, range;
      if (args.length >= 2) {
        const a = parseInt(args[0]), b = parseInt(args[1]);
        if (isNaN(a) || isNaN(b)) return api.sendMessage(fmt.err("أدخل أرقاماً صحيحة."), event.threadID);
        result = Math.floor(Math.random() * (b - a + 1)) + a;
        range  = a + " – " + b;
      } else {
        const sides = parseInt(args[0]) || 6;
        result = Math.floor(Math.random() * sides) + 1;
        range  = "1 – " + sides;
      }
      api.sendMessage(
        [fmt.header(), "", fmt.row("النطاق",  range,         "🎲"), fmt.row("النتيجة", String(result), "✨")].join("\n"),
        event.threadID
      );
    },
  };
  