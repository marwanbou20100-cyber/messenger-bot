"use strict";

const yts = require("yt-search");

// تحويل معرّف يوتيوب إلى رابط YouTube Music
function toYTMusic(videoId) {
  return "https://music.youtube.com/watch?v=" + videoId;
}

function formatDuration(sec) {
  if (!sec) return "؟";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ":" + String(s).padStart(2, "0");
}

module.exports = {
  name: "music",
  aliases: ["song", "اغنية", "موسيقى", "اغاني"],
  description: "البحث عن أغنية عبر YouTube Music وإرسال روابطها.",
  usage: "music <اسم الأغنية أو الفنان>",
  category: "Group",

  async execute({ api, event, args }) {
    const { threadID } = event;
    const query = args.join(" ").trim();

    if (!query) {
      return api.sendMessage(
        "🎵 ابحث عن أغنية:\n\nالاستخدام: -music <اسم الأغنية>\nمثال: -music فيروز نسم علينا الهوى",
        threadID
      );
    }

    try {
      await api.sendMessage("🔍 جاري البحث في YouTube Music...", threadID);

      // البحث مع كلمة music لتحسين النتائج الموسيقية
      const result = await yts(query + " music");
      const videos = (result.videos || [])
        .filter(v => v.videoId && v.seconds > 0 && v.seconds < 600) // تصفية: بين 0 و10 دقائق
        .slice(0, 5);

      if (!videos.length) {
        return api.sendMessage("❌ لم يُعثر على نتائج لـ «" + query + "».", threadID);
      }

      const lines = [
        "🎵 نتائج YouTube Music",
        "━━━━━━━━━━━━━━━━━━━━━━",
        "🔎 " + query,
        "",
      ];

      videos.forEach((v, i) => {
        lines.push(
          (i + 1) + ". 🎧 " + v.title,
          "   👤 " + (v.author?.name || "غير معروف"),
          "   ⏱️ " + formatDuration(v.seconds),
          "   🔗 " + toYTMusic(v.videoId),
          ""
        );
      });

      lines.push("▶️ افتح الرابط في تطبيق YouTube Music للاستماع مباشرة.");

      return api.sendMessage(lines.join("\n"), threadID);

    } catch (e) {
      return api.sendMessage("❌ حدث خطأ أثناء البحث: " + e.message, threadID);
    }
  },
};
