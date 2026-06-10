"use strict";

const yts          = require("yt-search");
const youtubedl    = require("youtube-dl-exec");
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
  const url = "https://www.youtube.com/watch?v=" + videoId;
  await youtubedl(url, {
    extractAudio: true,
    audioFormat: "mp3",
    audioQuality: 5,
    output: outPath,
    noPlaylist: true,
    noWarnings: true,
    preferFreeFormats: true,
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
            await _api.sendMessage(
              "❌ رقم غير صحيح. اختر من 1 إلى " + videos.length + "، أو 0 للإلغاء.",
              rTID
            );
            return pendingReplies.KEEP;
          }

          const v = videos[idx];
          await _api.sendMessage(
            "⏳ جاري تحميل «" + v.title + "»...\nقد يستغرق 10-30 ثانية.",
            rTID
          );

          // youtube-dl-exec يضيف .mp3 تلقائياً — نحدد القاعدة فقط
          const base    = path.join(os.tmpdir(), "music_" + Date.now());
          const outFile = base + ".mp3";

          try {
            await downloadAudio(v.videoId, outFile);

            // ابحث عن الملف الفعلي (قد يختلف الامتداد)
            const dir     = os.tmpdir();
            const prefix  = path.basename(base);
            const found   = fs.readdirSync(dir).find(f => f.startsWith(prefix));
            const actual  = found ? path.join(dir, found) : outFile;

            if (!fs.existsSync(actual))
              return _api.sendMessage("❌ لم يُنشأ الملف، جرّب أغنية أخرى.", rTID);

            const sizeMB = fs.statSync(actual).size / (1024 * 1024);
            if (sizeMB < 0.01)
              return _api.sendMessage("❌ الملف فارغ، جرّب أغنية أخرى.", rTID);
            if (sizeMB > 25)
              return _api.sendMessage(
                "❌ حجم الملف كبير جداً (" + sizeMB.toFixed(1) + " MB). جرّب أغنية أقصر.",
                rTID
              );

            await _api.sendMessage({
              body: "🎵 " + v.title +
                    "\n👤 " + ((v.author && v.author.name) || "؟") +
                    "  ⏱️ " + formatDuration(v.seconds),
              attachment: fs.createReadStream(actual),
            }, rTID);

          } catch (e) {
            _api.sendMessage("❌ فشل التحميل: " + e.message, rTID);
          } finally {
            try {
              const dir    = os.tmpdir();
              const prefix = path.basename(base);
              fs.readdirSync(dir)
                .filter(f => f.startsWith(prefix))
                .forEach(f => { try { fs.unlinkSync(path.join(dir, f)); } catch {} });
            } catch {}
          }
        },
      });

    } catch (e) {
      return api.sendMessage("❌ حدث خطأ أثناء البحث: " + e.message, threadID);
    }
  },
};
