"use strict";

const yts  = require("yt-search");
const https = require("https");
const fs    = require("fs");
const path  = require("path");
const os    = require("os");
const pendingReplies = require("../utils/pendingReplies");

function formatDuration(sec) {
  if (!sec) return "؟";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ":" + String(s).padStart(2, "0");
}

// يحصل على رابط التحميل المباشر عبر cobalt.tools (مجاني، بلا مكتبات)
function getCobaltUrl(videoId) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      url: "https://www.youtube.com/watch?v=" + videoId,
      downloadMode: "audio",
      audioFormat: "mp3",
      audioQuality: "128"
    });
    const req = https.request({
      hostname: "api.cobalt.tools",
      path: "/",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Content-Length": Buffer.byteLength(body),
      }
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try {
          const r = JSON.parse(d);
          if (r.url) return resolve(r.url);
          if (r.status === "stream" || r.status === "redirect") return resolve(r.url);
          reject(new Error(
            (r.error && (r.error.code || r.error)) ||
            "cobalt: لم يُعثر على رابط تحميل"
          ));
        } catch (e) { reject(e); }
      });
    });
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("cobalt: انتهى وقت الاتصال")); });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// تحميل ملف من URL مع دعم التوجيه التلقائي
function downloadFile(url, outPath, redirects) {
  redirects = redirects || 0;
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error("عدد كبير من إعادة التوجيه"));
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, res => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        return downloadFile(res.headers.location, outPath, redirects + 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error("HTTP " + res.statusCode));
      }
      const file = fs.createWriteStream(outPath);
      res.pipe(file);
      file.on("finish", resolve);
      file.on("error", reject);
      const t = setTimeout(() => { res.destroy(); reject(new Error("انتهى وقت التحميل")); }, 90000);
      file.on("finish", () => clearTimeout(t));
    }).on("error", reject);
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
          await _api.sendMessage("⏳ جاري تجهيز «" + v.title + "»...", rTID);

          const tmpFile = path.join(os.tmpdir(), "music_" + Date.now() + ".mp3");
          try {
            // 1. احصل على رابط التحميل من cobalt.tools
            const dlUrl = await getCobaltUrl(v.videoId);

            // 2. حمّل الملف
            await downloadFile(dlUrl, tmpFile);

            // 3. تحقق من الحجم
            const sizeMB = fs.statSync(tmpFile).size / (1024 * 1024);
            if (sizeMB < 0.01)
              return _api.sendMessage("❌ الملف فارغ، جرّب أغنية أخرى.", rTID);
            if (sizeMB > 25)
              return _api.sendMessage("❌ حجم الملف كبير جداً (" + sizeMB.toFixed(1) + " MB). جرّب أغنية أقصر.", rTID);

            // 4. أرسل كرسالة صوتية
            await _api.sendMessage({
              body: "🎵 " + v.title +
                    "\n👤 " + ((v.author && v.author.name) || "؟") +
                    "  ⏱️ " + formatDuration(v.seconds),
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
