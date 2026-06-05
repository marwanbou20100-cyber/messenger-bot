"use strict";

  const fs   = require("fs");
  const path = require("path");
  const https = require("https");

  function downloadToFile(url, dest, redirects) {
    redirects = redirects || 0;
    if (redirects > 5) return Promise.reject(new Error("Too many redirects"));
    return new Promise((resolve, reject) => {
      https.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Madox-Bot/2.1)",
          "Accept": "image/jpeg,image/png,image/*"
        }
      }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          res.resume();
          return downloadToFile(res.headers.location, dest, redirects + 1).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error("HTTP " + res.statusCode));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          if (buf.length < 500) return reject(new Error("الصورة المستلمة صغيرة جداً أو فارغة"));
          fs.writeFileSync(dest, buf);
          resolve(dest);
        });
        res.on("error", reject);
      }).on("error", reject);
    });
  }

  module.exports = {
    name: "imagine",
    aliases: ["img", "image", "صورة"],
    description: "توليد صورة بالذكاء الاصطناعي",
    usage: "-imagine [وصف الصورة]",
    adminOnly: false,
    groupOnly: false,

    async execute({ api, event, args }) {
      const { threadID } = event;

      if (!args.length) {
        return api.sendMessage(
          "🎨 اكتب وصف الصورة التي تريدها.\nمثال: -imagine قطة تجلس على القمر",
          threadID
        );
      }

      const prompt = args.join(" ");
      await api.sendMessage("🎨 جاري رسم الصورة...", threadID).catch(() => {});

      const seed = Math.floor(Math.random() * 999999);
      const tmpPath = path.join("/tmp", "img_" + Date.now() + ".jpg");

      try {
        const imageUrl =
          "https://image.pollinations.ai/prompt/" +
          encodeURIComponent(prompt) +
          "?width=1024&height=1024&model=flux&nologo=true&seed=" + seed;

        await downloadToFile(imageUrl, tmpPath);

        await api.sendMessage(
          {
            body: "🖼️ " + prompt,
            attachment: [fs.createReadStream(tmpPath)],
          },
          threadID
        );
      } catch (e) {
        await api.sendMessage("❌ فشل توليد الصورة: " + e.message, threadID).catch(() => {});
      } finally {
        try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
      }
    },
  };
  