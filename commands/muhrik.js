"use strict";
  const config = require("../config.json");

  const _engines = new Map(); // threadID → { message, intervalMs, timer, running, msgCount, failCount }

  function isAdmin(id) { return (config.bot.adminIDs || []).includes(String(id)); }

  function _stopEngine(threadID) {
    const eng = _engines.get(threadID);
    if (!eng) return false;
    if (eng.timer) { clearInterval(eng.timer); eng.timer = null; }
    eng.running = false;
    return true;
  }

  function _startEngine(api, threadID) {
    const eng = _engines.get(threadID);
    if (!eng || !eng.message) return false;
    if (eng.running) _stopEngine(threadID);
    eng.running = true;
    eng.failCount = 0;
    eng.timer = setInterval(async () => {
      if (!eng.running) return;
      try {
        await api.sendMessage(eng.message, threadID);
        eng.msgCount++;
      } catch {
        eng.failCount = (eng.failCount || 0) + 1;
        if (eng.failCount >= 5) {
          _stopEngine(threadID);
          api.sendMessage("⚠️ المحرك توقف بسبب أخطاء متكررة في الإرسال.", threadID).catch(() => {});
        }
      }
    }, eng.intervalMs);
    if (eng.timer.unref) eng.timer.unref();
    return true;
  }

  module.exports = {
    name: "محرك",
    aliases: ["engine", "muhrik"],
    description: "محرك إرسال الرسائل المتكررة في المجموعة.",
    usage: [
      "-محرك              ← عرض الحالة",
      "-محرك رسالة <نص>  ← تعيين الرسالة",
      "-محرك وقت <ثواني> ← تعيين الفترة (الحد الأدنى 10 ثوانٍ)",
      "-محرك تشغيل        ← تشغيل المحرك",
      "-محرك ايقاف        ← إيقاف المحرك",
    ].join("\n"),
    category: "Admin",
    adminOnly: true,
    groupOnly: true,

    execute({ api, event, args }) {
      const { threadID, senderID } = event;
      if (!isAdmin(senderID)) return api.sendMessage("🔒 هذا الأمر للمشرف الرئيسي فقط.", threadID);

      if (!_engines.has(threadID)) {
        _engines.set(threadID, { message: "", intervalMs: 30000, timer: null, running: false, msgCount: 0, failCount: 0 });
      }
      const eng = _engines.get(threadID);
      const sub = (args[0] || "").trim();

      if (!sub) {
        const st  = eng.running ? "🟢 يعمل" : "🔴 متوقف";
        const msg = eng.message
          ? `«${eng.message.slice(0, 60)}${eng.message.length > 60 ? "..." : ""}»`
          : "لم تُعيَّن بعد";
        return api.sendMessage([
          "⚙️  حالة المحرك",
          "─────────────────",
          `• الحالة     : ${st}`,
          `• الرسالة   : ${msg}`,
          `• الفترة    : كل ${eng.intervalMs / 1000} ثانية`,
          `• رسائل مُرسَلة: ${eng.msgCount}`,
          "",
          "الأوامر:",
          "-محرك رسالة <نص>  ← تعيين الرسالة",
          "-محرك وقت <ثواني> ← تعيين الفترة",
          "-محرك تشغيل        ← تشغيل",
          "-محرك ايقاف        ← إيقاف",
        ].join("\n"), threadID);
      }

      if (sub === "ايقاف" || sub === "إيقاف" || sub === "stop") {
        if (!eng.running) return api.sendMessage("ℹ️ المحرك متوقف مسبقاً.", threadID);
        _stopEngine(threadID);
        return api.sendMessage(`🔴 تم إيقاف المحرك.\nإجمالي الرسائل المُرسلة: ${eng.msgCount}`, threadID);
      }

      if (sub === "تشغيل" || sub === "start") {
        if (!eng.message) return api.sendMessage("❌ عيّن الرسالة أولاً:\n-محرك رسالة <النص>", threadID);
        if (eng.running) return api.sendMessage("ℹ️ المحرك يعمل بالفعل.\nللإيقاف: -محرك ايقاف", threadID);
        _startEngine(api, threadID);
        return api.sendMessage(`🟢 تم تشغيل المحرك!\nسيُرسل كل ${eng.intervalMs / 1000} ثانية:\n«${eng.message}»`, threadID);
      }

      if (sub === "رسالة" || sub === "message") {
        const newMsg = args.slice(1).join(" ").trim();
        if (!newMsg) return api.sendMessage("❌ اكتب الرسالة بعد الأمر:\n-محرك رسالة <النص>", threadID);
        const wasRunning = eng.running;
        _stopEngine(threadID);
        eng.message = newMsg;
        eng.msgCount = 0;
        if (wasRunning) {
          _startEngine(api, threadID);
          return api.sendMessage(`✅ تم تغيير رسالة المحرك وإعادة تشغيله:\n«${newMsg}»`, threadID);
        }
        return api.sendMessage(`✅ تم تعيين رسالة المحرك:\n«${newMsg}»\n\nلتشغيله: -محرك تشغيل`, threadID);
      }

      if (sub === "وقت" || sub === "time") {
        const secs = parseInt(args[1], 10);
        if (isNaN(secs) || secs < 10) return api.sendMessage("❌ الحد الأدنى 10 ثوانٍ.\nمثال: -محرك وقت 30", threadID);
        const wasRunning = eng.running;
        _stopEngine(threadID);
        eng.intervalMs = secs * 1000;
        if (wasRunning) {
          _startEngine(api, threadID);
          return api.sendMessage(`✅ تم تغيير الفترة إلى ${secs} ثانية وإعادة تشغيل المحرك.`, threadID);
        }
        return api.sendMessage(`✅ تم تعيين الفترة: كل ${secs} ثانية.`, threadID);
      }

      return api.sendMessage("❌ أمر غير معروف.\nاستخدم: -محرك للمساعدة", threadID);
    },
  };
  