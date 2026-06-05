"use strict";
  const fs = require("fs");
  const path = require("path");
  const https = require("https");
  const http = require("http");

  function downloadImage(url, dest) {
    return new Promise((resolve, reject) => {
      const proto = url.startsWith("https") ? https : http;
      const file = fs.createWriteStream(dest);
      proto.get(url, { headers: { "User-Agent": "Madox-Bot/2.1" } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          fs.unlink(dest, () => {});
          return downloadImage(res.headers.location, dest).then(resolve).catch(reject);
        }
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
      }).on("error", (e) => {
        fs.unlink(dest, () => {});
        reject(e);
      });
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
      const { threadID, messageID } = event;

      if (!args.length) {
        return api.sendMessage("🎨 اكتب وصف الصورة التي تريدها.\nمثال: -imagine قطة تجلس على القمر", threadID, messageID);
      }

      const prompt = args.join(" ");
      api.sendMessage("🎨 جاري رسم الصورة...", threadID);

      const tmpPath = path.join("/tmp", "imagine_" + Date.now() + ".jpg");

      try {
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&model=flux&nologo=true&seed=${Math.floor(Math.random()*99999)}`;

        await downloadImage(imageUrl, tmpPath);

        await api.sendMessage(
          {
            body: "🖼️ " + prompt,
            attachment: fs.createReadStream(tmpPath)
          },
          threadID,
          messageID
        );
      } catch (e) {
        api.sendMessage("❌ فشل توليد الصورة: " + e.message, threadID, messageID);
      } finally {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      }
    }
  };
  