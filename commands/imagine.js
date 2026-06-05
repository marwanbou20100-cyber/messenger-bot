"use strict";

  const fs   = require("fs");
  const path = require("path");

  module.exports = {
    name: "imagine",
    aliases: ["img", "image", "صورة"],
    description: "توليد صورة بالذكاء الاصطناعي",
    usage: "-imagine [وصف الصورة]",
    adminOnly: false,
    groupOnly: false,

    async execute({ api, event, args }) {
      const { threadID, messageID } = event;

      if (!args.length) {
        return api.sendMessage(
          "🎨 اكتب وصف الصورة التي تريدها.\nمثال: -imagine قطة تجلس على القمر",
          threadID,
          messageID
        );
      }

      const prompt = args.join(" ");
      await api.sendMessage("🎨 جاري رسم الصورة...", threadID).catch(() => {});

      const tmpPath = path.join("/tmp", "imagine_" + Date.now() + ".jpg");

      try {
        const seed = Math.floor(Math.random() * 999999);
        const imageUrl =
          "https://image.pollinations.ai/prompt/" +
          encodeURIComponent(prompt) +
          "?width=1024&height=1024&model=flux&nologo=true&seed=" + seed;

        // Download image using fetch (follows redirects automatically)
        const res = await fetch(imageUrl, {
          headers: { "User-Agent": "Madox-Bot/2.1" },
          signal: AbortSignal.timeout(60000),
        });

        if (!res.ok) throw new Error("فشل تحميل الصورة: " + res.status);

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length < 1000) throw new Error("الصورة المستلمة فارغة أو تالفة");

        fs.writeFileSync(tmpPath, buffer);

        await api.sendMessage(
          {
            body: "🖼️ " + prompt,
            attachment: fs.createReadStream(tmpPath),
          },
          threadID,
          messageID
        );
      } catch (e) {
        await api.sendMessage("❌ فشل توليد الصورة: " + e.message, threadID, messageID).catch(() => {});
      } finally {
        try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
      }
    },
  };
  