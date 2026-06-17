"use strict";

  const config = require("../config.json");

  module.exports = {
    name: "ai",
    aliases: ["chat", "gpt"],
    description: "تحدث مع الذكاء الاصطناعي",
    usage: "-ai [سؤالك هنا]",
    adminOnly: false,
    groupOnly: false,

    async execute({ api, event, args }) {
      const { threadID } = event;

      if (!args.length) {
        return api.sendMessage(
          "❓ اكتب سؤالك بعد الأمر.\nمثال: " + config.prefix + "ai ما هو الذكاء الاصطناعي؟",
          threadID
        );
      }

      const prompt  = args.join(" ");
      const botName = (config.bot && config.bot.name) || "Phoenix";

      await api.sendMessage("⏳ جاري التفكير...", threadID).catch(() => {});

      try {
        const system =
          "أنت مساعد ذكي اسمك " + botName + ". " +
          "أجب باللغة التي يكتب بها المستخدم. كن مختصراً ومفيداً.";

        const url =
          "https://text.pollinations.ai/" +
          encodeURIComponent(prompt) +
          "?model=openai&system=" +
          encodeURIComponent(system);

        const res = await fetch(url, {
          headers: { "User-Agent": botName + "-Bot/2.1" },
          signal: AbortSignal.timeout(30000),
        });

        if (!res.ok) throw new Error("خطأ في الخادم: " + res.status);

        const text = (await res.text()).trim();
        if (!text) throw new Error("لم يُرسل الذكاء الاصطناعي رداً");

        return api.sendMessage("🤖 " + text, threadID);
      } catch (e) {
        return api.sendMessage("❌ حدث خطأ: " + e.message, threadID).catch(() => {});
      }
    },
  };
