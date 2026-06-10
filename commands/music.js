"use strict";

const yts          = require("yt-search");
const playdl       = require("play-dl");
const fs           = require("fs");
const path         = require("path");
const os           = require("os");
const pendingReplies = require("../utils/pendingReplies");

function formatDuration(sec) {
  if (!sec) return "؟";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ":" + String(s).padStart(2, "0");
}

async function downloadAudio(videoId, outPath) {
  const url    = "https://www.youtube.com/watch?v=" + videoId;
  const source = await playdl.stream(url, { quality: 0 });
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outPath);
    source.stream.pipe(file);
    file.on("finish", resolve);
    source.stream.on("error", reject);
    file.on("error", reject);
    const t = setTimeout(() => {
      source.stream.destroy();
      reject(new Error("تجاوز وقت التحميل (60 ث)"));
    }, 60000);
    file.on("finish", () => clearTimeout(t));
  });
}

module.exports = {
  name: "music",
  aliases: ["song", "اغنية", "موسيقى", "اغاني"],
  description: "البحث عن أغنية وإرسالها كرسالة صوتية.",
  usage: "music <اسم الأغنية أو الفنان>",
  category: "Group",

  async execute({ api, event, args }) {
    const { threadID, senderID } = event;
    const query = args.join(" ").trim();

    if (!query) {
      return api.sendMessage(
        "🎵 ابحث عن أغنية:\n\nالاستخدام: -music <اسم الأغنية>\nمثال: -music فيروز نسم علينا الهوى",
        threadID
      );
    }

    try {
      await api.sendMessage("🔍 جاري البحث في YouTube Music...", threadID);

      const result = await yts(query + " music");
      const videos = (result.videos || [])
        .filter(v => v.videoId && v.seconds > 0 && v.seconds < 600)
        .slice(0, 5);

      if (!videos.length)
        return api.sendMessage("❌ لم يُعثر على نتائج لـ «" + query + "».", threadID);

      const lines = ["🎵 نتائج YouTube Music", "━━━━━━━━━━━━━━━━━━━━━━"];
      videos.forEach((v, i) => {
        lines.push(
          (i + 1) + ". 🎧 " + v.title +
          "\n   👤 " + ((v.author && v.author.name) || "؟") +
          "  ⏱️ " + formatDuration(v.seconds)
        );
      });
      lines.push("\nأرسل رقم الأغنية للتحميل، أو 0 للإلغاء.");
      await api.sendMessage(lines.join("\n"), threadID);

      pendingReplies.set(senderID, {
        handler: async (input, _api, _ev) => {
          const rTID = _ev.threadID;
          const ch   = input.trim();

          if (ch === "0" || ch === "إلغاء")
            return _api.sendMessage("❌ تم الإلغاء.", rTID);

          const idx = parseInt(ch) - 1;
          if (isNaN(idx) || idx < 0 || idx >= videos.length) {
            await _api.sendMessage("❌ رقم غير صحيح. اختر من 1 إلى " + videos.length + "، أو 0 للإلغاء.", rTID);
            return pendingReplies.KEEP;
          }

          const v = videos[idx];
          await _api.sendMessage("⏳ جاري تحميل «" + v.title + "»...\nقد يستغرق بضع ثوانٍ.", rTID);

          const tmpFile = path.join(os.tmpdir(), "music_" + Date.now() + ".webm");
          try {
            await downloadAudio(v.videoId, tmpFile);

            const sizeMB = fs.statSync(tmpFile).size / (1024 * 1024);
            if (sizeMB > 25)
              return _api.sendMessage("❌ حجم الملف كبير جداً (" + sizeMB.toFixed(1) + " MB).", rTID);

            await _api.sendMessage({
              body: "🎵 " + v.title + "\n👤 " + ((v.author && v.author.name) || "؟") + "  ⏱️ " + formatDuration(v.seconds),
              attachment: fs.createReadStream(tmpFile),
            }, rTID);

          } catch (e) {
            _api.sendMessage("❌ فشل التحميل: " + e.message, rTID);
          } finally {
            try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch {}
          }
        },
      });

    } catch (e) {
      return api.sendMessage("❌ حدث خطأ أثناء البحث: " + e.message, threadID);
    }
  },
};
