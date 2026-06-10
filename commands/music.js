"use strict";

const yts  = require("yt-search");
const https = require("https");
const fs    = require("fs");
const path  = require("path");
const os    = require("os");
const { execFile } = require("child_process");
const pendingReplies = require("../utils/pendingReplies");

// ─── yt-dlp auto-downloader ────────────────────────────────────────────────
const YTDLP_BIN = path.join(os.tmpdir(), "yt-dlp");
const YTDLP_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";

let _ytdlpReady = null; // promise يُعيد مسار الأداة

function followRedirects(url) {
  return new Promise((resolve, reject) => {
    function doGet(u, depth) {
      if (depth > 10) return reject(new Error("too many redirects"));
      https.get(u, { headers: { "User-Agent": "Mozilla/5.0" } }, res => {
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location)
          return doGet(res.headers.location, depth + 1);
        resolve({ res, finalUrl: u });
      }).on("error", reject);
    }
    doGet(url, 0);
  });
}

function downloadBinary(url, dest) {
  return new Promise(async (resolve, reject) => {
    try {
      const { res } = await followRedirects(url);
      if (res.statusCode !== 200) return reject(new Error("HTTP " + res.statusCode));
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on("finish", resolve);
      file.on("error", reject);
    } catch (e) { reject(e); }
  });
}

function tryBin(bin) {
  return new Promise(resolve =>
    execFile(bin, ["--version"], { timeout: 5000 }, err => resolve(!err))
  );
}

function ensureYtDlp() {
  if (_ytdlpReady) return _ytdlpReady;
  _ytdlpReady = (async () => {
    // 1. هل هو مثبّت على النظام؟
    if (await tryBin("yt-dlp"))  return "yt-dlp";
    if (await tryBin("yt-dlp3")) return "yt-dlp3";

    // 2. هل حمّلناه من قبل؟
    if (fs.existsSync(YTDLP_BIN) && await tryBin(YTDLP_BIN)) return YTDLP_BIN;

    // 3. حمّله الآن من GitHub Releases
    await downloadBinary(YTDLP_URL, YTDLP_BIN);
    fs.chmodSync(YTDLP_BIN, 0o755);

    if (!(await tryBin(YTDLP_BIN)))
      throw new Error("تعذّر تشغيل yt-dlp بعد التحميل");

    return YTDLP_BIN;
  })().catch(e => { _ytdlpReady = null; throw e; });
  return _ytdlpReady;
}

function runYtDlp(binPath, videoId, outBase) {
  const url = "https://www.youtube.com/watch?v=" + videoId;
  const args = [
    url,
    "-x", "--audio-format", "mp3", "--audio-quality", "5",
    "--no-playlist", "--no-warnings",
    "-o", outBase + ".%(ext)s",
  ];
  return new Promise((resolve, reject) => {
    execFile(binPath, args, { timeout: 90000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      // ابحث عن الملف الناتج
      const dir = path.dirname(outBase);
      const base = path.basename(outBase);
      const found = fs.readdirSync(dir).find(f => f.startsWith(base));
      if (!found) return reject(new Error("لم يُنشأ الملف الصوتي"));
      resolve(path.join(dir, found));
    });
  });
}
// ──────────────────────────────────────────────────────────────────────────

function formatDuration(sec) {
  if (!sec) return "؟";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ":" + String(s).padStart(2, "0");
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
            "⏳ جاري تجهيز «" + v.title + "»...",
            rTID
          );

          const outBase = path.join(os.tmpdir(), "music_" + Date.now());
          let   actual  = null;

          try {
            // تأكد من وجود yt-dlp (يُحمَّل تلقائياً إن لم يكن موجوداً)
            const bin = await ensureYtDlp();
            actual = await runYtDlp(bin, v.videoId, outBase);

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
              if (actual && fs.existsSync(actual)) fs.unlinkSync(actual);
            } catch {}
          }
        },
      });

    } catch (e) {
      return api.sendMessage("❌ حدث خطأ: " + e.message, threadID);
    }
  },
};
