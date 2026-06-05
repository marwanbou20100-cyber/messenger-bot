"use strict";

  module.exports = {
    name: "ai",
    aliases: ["chat", "gpt"],
    description: "تحدث مع الذكاء الاصطناعي",
    usage: "-ai [سؤالك هنا]",
    adminOnly: false,
    groupOnly: false,

    async execute({ api, event, args }) {
      const { threadID, messageID } = event;

      if (!args.length) {
        return api.sendMessage("❓ اكتب سؤالك بعد الأمر.\nمثال: -ai ما هو الذكاء الاصطناعي؟", threadID, messageID);
      }

      const prompt = args.join(" ");
      api.sendMessage("⏳ جاري التفكير...", threadID);

      try {
        const systemPrompt = "أنت مساعد ذكي اسمك Madox. أجب باللغة التي يكتب بها المستخدم. كن مختصراً ومفيداً.";
        const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai&system=${encodeURIComponent(systemPrompt)}`;

        const res = await fetch(url, {
          headers: { "User-Agent": "Madox-Bot/2.1" },
          signal: AbortSignal.timeout(30000)
        });

        if (!res.ok) throw new Error("API error: " + res.status);

        const text = await res.text();
        const reply = text.trim() || "لم أحصل على رد. حاول مجدداً.";

        return api.sendMessage("🤖 " + reply, threadID, messageID);
      } catch (e) {
        return api.sendMessage("❌ حدث خطأ: " + e.message, threadID, messageID);
      }
    }
  };
  