"use strict";
  const fmt = require("../utils/fmt");
  module.exports = {
    name: "coinflip",
    aliases: ["flip", "coin", "عملة"],
    description: "رمي عملة: رأس أم كتابة.",
    usage: "coinflip",
    category: "Fun",
    async execute({ api, event }) {
      const result = Math.random() < 0.5 ? "رأس 🪙" : "كتابة 📝";
      api.sendMessage(fmt.header() + "\n\n" + fmt.row("النتيجة", result, "🎰"), event.threadID);
    },
  };
  